use anchor_lang::prelude::*;
use anchor_lang::system_program::{self, System, Transfer as SolTransfer};
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{mint_to, Mint, MintTo, Token, TokenAccount},
};
use crate::{
    constants::*,
    errors::TredieError,
    events::Trade,
    state::{MarketFactory, Market, MindshareOracle},
};

#[derive(Accounts)]
pub struct Buy<'info> {
    #[account(
        seeds = [FACTORY_SEED],
        bump = factory.bump,
        constraint = !factory.paused @ TredieError::FactoryPaused,
    )]
    pub factory: Account<'info, MarketFactory>,

    /// Market PDA: holds data, SOL reserves (acts as vault), and is the mint authority.
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

    /// ATA created on first buy if needed.
    #[account(
        init_if_needed,
        payer = buyer,
        associated_token::mint = mint,
        associated_token::authority = buyer,
    )]
    pub buyer_token_account: Account<'info, TokenAccount>,

    /// CHECK: validated via factory.fee_recipient address constraint
    #[account(
        mut,
        address = factory.fee_recipient,
    )]
    pub fee_recipient: UncheckedAccount<'info>,

    #[account(mut)]
    pub buyer: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub(crate) fn handler(ctx: Context<Buy>, sol_amount_in: u64, min_tokens_out: u64) -> Result<()> {
    require!(sol_amount_in > 0, TredieError::InvalidAmount);

    let factory = &ctx.accounts.factory;
    let oracle = &ctx.accounts.oracle;
    let market = &ctx.accounts.market;

    // --- Protocol fee ---
    let fee = (sol_amount_in as u128)
        .checked_mul(factory.fee_basis_points as u128)
        .ok_or(TredieError::MathOverflow)?
        .checked_div(10_000)
        .ok_or(TredieError::MathOverflow)? as u64;

    let sol_after_fee = sol_amount_in
        .checked_sub(fee)
        .ok_or(TredieError::FeeExceedsAmount)?;

    // --- Bonding curve (constant product AMM) ---
    // Price determined purely by supply/demand: base_virtual_sol + real_sol_reserves
    let pool_sol = (market.base_virtual_sol as u128)
        .checked_add(market.real_sol_reserves as u128)
        .ok_or(TredieError::MathOverflow)?;

    let pool_tokens = (market.virtual_token_supply as u128)
        .checked_sub(market.tokens_minted as u128)
        .ok_or(TredieError::InsufficientReserves)?;

    let k = pool_sol
        .checked_mul(pool_tokens)
        .ok_or(TredieError::MathOverflow)?;

    let new_pool_sol = pool_sol
        .checked_add(sol_after_fee as u128)
        .ok_or(TredieError::MathOverflow)?;

    let new_pool_tokens = k
        .checked_div(new_pool_sol)
        .ok_or(TredieError::MathOverflow)?;

    let tokens_out = pool_tokens
        .checked_sub(new_pool_tokens)
        .ok_or(TredieError::MathOverflow)? as u64;

    require!(tokens_out > 0, TredieError::ZeroTokenOutput);
    require!(tokens_out >= min_tokens_out, TredieError::SlippageExceeded);

    // --- Transfer SOL: buyer → market vault (net amount after fee) ---
    system_program::transfer(
        CpiContext::new(
            System::id(),
            SolTransfer {
                from: ctx.accounts.buyer.to_account_info(),
                to: ctx.accounts.market.to_account_info(),
            },
        ),
        sol_after_fee,
    )?;

    // --- Transfer fee: buyer → fee_recipient (buyer signs both transfers) ---
    if fee > 0 {
        system_program::transfer(
            CpiContext::new(
                System::id(),
                SolTransfer {
                    from: ctx.accounts.buyer.to_account_info(),
                    to: ctx.accounts.fee_recipient.to_account_info(),
                },
            ),
            fee,
        )?;
    }

    // --- Mint tokens: market PDA signs as mint authority ---
    let identifier = ctx.accounts.market.identifier;
    let bump = ctx.accounts.market.bump;
    let seeds: &[&[u8]] = &[MARKET_SEED, &identifier, &[bump]];
    let signer_seeds = &[seeds];

    mint_to(
        CpiContext::new_with_signer(
            Token::id(),
            MintTo {
                mint: ctx.accounts.mint.to_account_info(),
                to: ctx.accounts.buyer_token_account.to_account_info(),
                authority: ctx.accounts.market.to_account_info(),
            },
            signer_seeds,
        ),
        tokens_out,
    )?;

    // --- Update state ---
    let market = &mut ctx.accounts.market;
    market.real_sol_reserves = market
        .real_sol_reserves
        .checked_add(sol_after_fee)
        .ok_or(TredieError::MathOverflow)?;
    market.tokens_minted = market
        .tokens_minted
        .checked_add(tokens_out)
        .ok_or(TredieError::MathOverflow)?;

    let clock = Clock::get()?;
    emit!(Trade {
        market: market.key(),
        side: 0,
        sol_amount: sol_amount_in,
        token_amount: tokens_out,
        ratchet_bps: oracle.ratchet_multiplier_bps,
        trader: ctx.accounts.buyer.key(),
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}
