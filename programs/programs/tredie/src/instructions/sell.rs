use anchor_lang::prelude::*;
use anchor_lang::system_program::System;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{burn, Burn, Mint, Token, TokenAccount},
};
use crate::{
    constants::*,
    errors::TredieError,
    events::Trade,
    state::{MarketFactory, Market, MindshareOracle},
};

#[derive(Accounts)]
pub struct Sell<'info> {
    #[account(
        seeds = [FACTORY_SEED],
        bump = factory.bump,
        constraint = !factory.paused @ TredieError::FactoryPaused,
    )]
    pub factory: Account<'info, MarketFactory>,

    #[account(
        mut,
        seeds = [MARKET_SEED, &market.identifier],
        bump = market.bump,
    )]
    pub market: Account<'info, Market>,

    #[account(
        mut,
        address = market.mint,
    )]
    pub mint: Account<'info, Mint>,

    #[account(
        seeds = [ORACLE_SEED, market.key().as_ref()],
        bump = oracle.bump,
    )]
    pub oracle: Account<'info, MindshareOracle>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = seller,
    )]
    pub seller_token_account: Account<'info, TokenAccount>,

    /// CHECK: validated via factory.fee_recipient address constraint
    #[account(
        mut,
        address = factory.fee_recipient,
    )]
    pub fee_recipient: UncheckedAccount<'info>,

    #[account(mut)]
    pub seller: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub(crate) fn handler(ctx: Context<Sell>, tokens_in: u64, min_sol_out: u64) -> Result<()> {
    require!(tokens_in > 0, TredieError::InvalidAmount);

    let factory = &ctx.accounts.factory;
    let oracle = &ctx.accounts.oracle;
    let market = &ctx.accounts.market;

    // --- Bonding curve reverse (constant product AMM) ---
    let pool_sol = (market.base_virtual_sol as u128)
        .checked_add(market.real_sol_reserves as u128)
        .ok_or(TredieError::MathOverflow)?;

    let pool_tokens = (market.virtual_token_supply as u128)
        .checked_sub(market.tokens_minted as u128)
        .ok_or(TredieError::InsufficientReserves)?;

    let k = pool_sol
        .checked_mul(pool_tokens)
        .ok_or(TredieError::MathOverflow)?;

    let new_pool_tokens = pool_tokens
        .checked_add(tokens_in as u128)
        .ok_or(TredieError::MathOverflow)?;

    let new_pool_sol = k
        .checked_div(new_pool_tokens)
        .ok_or(TredieError::MathOverflow)?;

    let sol_before_fee = {
        let raw = pool_sol
            .checked_sub(new_pool_sol)
            .ok_or(TredieError::MathOverflow)? as u64;
        // Integer division in constant product can round sol_before_fee up by 1 lamport
        // when selling exactly the tokens from a prior buy.  Cap at actual reserves.
        raw.min(market.real_sol_reserves)
    };

    require!(sol_before_fee > 0, TredieError::InvalidAmount);

    let fee = (sol_before_fee as u128)
        .checked_mul(factory.fee_basis_points as u128)
        .ok_or(TredieError::MathOverflow)?
        .checked_div(10_000)
        .ok_or(TredieError::MathOverflow)? as u64;

    let sol_to_seller = sol_before_fee
        .checked_sub(fee)
        .ok_or(TredieError::FeeExceedsAmount)?;

    require!(sol_to_seller >= min_sol_out, TredieError::SlippageExceeded);

    // --- Burn tokens from seller ---
    // Anchor 1.0: CpiContext takes program Pubkey.
    burn(
        CpiContext::new(
            Token::id(),
            Burn {
                mint: ctx.accounts.mint.to_account_info(),
                from: ctx.accounts.seller_token_account.to_account_info(),
                authority: ctx.accounts.seller.to_account_info(),
            },
        ),
        tokens_in,
    )?;

    // --- Transfer SOL: market → seller + fee_recipient ---
    // Market is program-owned → can directly manipulate lamports.
    **ctx.accounts.market.to_account_info().try_borrow_mut_lamports()? -= sol_before_fee;
    **ctx.accounts.seller.to_account_info().try_borrow_mut_lamports()? += sol_to_seller;
    **ctx.accounts.fee_recipient.to_account_info().try_borrow_mut_lamports()? += fee;

    // --- Update state ---
    let market = &mut ctx.accounts.market;
    market.real_sol_reserves = market
        .real_sol_reserves
        .checked_sub(sol_before_fee)
        .ok_or(TredieError::MathOverflow)?;
    market.tokens_minted = market
        .tokens_minted
        .checked_sub(tokens_in)
        .ok_or(TredieError::MathOverflow)?;

    let clock = Clock::get()?;
    emit!(Trade {
        market: market.key(),
        side: 1,
        sol_amount: sol_to_seller,
        token_amount: tokens_in,
        ratchet_bps: oracle.ratchet_multiplier_bps,
        trader: ctx.accounts.seller.key(),
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}
