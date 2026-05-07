use anchor_lang::prelude::*;
use anchor_lang::system_program::System;
use anchor_spl::token::{Mint, Token};
use crate::{
    constants::*,
    errors::TredieError,
    events::MarketCreated,
    state::{MarketFactory, Market, MindshareOracle},
};

#[derive(Accounts)]
#[instruction(identifier: [u8; 32], identifier_len: u8)]
pub struct CreateMarket<'info> {
    #[account(
        mut,
        seeds = [FACTORY_SEED],
        bump = factory.bump,
        constraint = !factory.paused @ TredieError::FactoryPaused,
    )]
    pub factory: Account<'info, MarketFactory>,

    /// Market PDA derived from identifier bytes (44 bytes padded with zeros).
    /// One market per asset globally — PDA uniqueness prevents duplicate races.
    /// Doubles as the SOL vault and SPL mint authority.
    #[account(
        init,
        payer = creator,
        space = 8 + Market::INIT_SPACE,
        seeds = [MARKET_SEED, &identifier],
        bump,
    )]
    pub market: Account<'info, Market>,

    /// SPL mint, authority = market PDA (no separate mint_auth PDA needed).
    #[account(
        init,
        payer = creator,
        mint::decimals = MARKET_TOKEN_DECIMALS,
        mint::authority = market,
        mint::freeze_authority = market,
    )]
    pub mint: Account<'info, Mint>,

    /// One oracle per market.
    #[account(
        init,
        payer = creator,
        space = 8 + MindshareOracle::INIT_SPACE,
        seeds = [ORACLE_SEED, market.key().as_ref()],
        bump,
    )]
    pub oracle: Account<'info, MindshareOracle>,

    /// Permissionless: any wallet can create a market.
    #[account(mut)]
    pub creator: Signer<'info>,

    /// Backend signer pubkey stored as oracle authority for update_mindshare.
    /// CHECK: Arbitrary pubkey validated only when update_mindshare is called.
    pub oracle_authority: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

pub(crate) fn handler(
    ctx: Context<CreateMarket>,
    identifier: [u8; 32],
    identifier_len: u8,
    asset_class: u8,
    base_virtual_sol: u64,
    virtual_token_supply: u64,
    elasticity_bps: u32,
) -> Result<()> {
    require!(
        identifier_len > 0 && identifier_len as usize <= IDENTIFIER_MAX_LEN,
        TredieError::InvalidIdentifier
    );
    require!(asset_class <= 6, TredieError::InvalidAssetClass);
    require!(base_virtual_sol > 0, TredieError::InvalidAmount);
    require!(virtual_token_supply > 0, TredieError::InvalidAmount);
    require!(elasticity_bps <= 20_000, TredieError::InvalidElasticity);

    let clock = Clock::get()?;

    let market = &mut ctx.accounts.market;
    market.bump = ctx.bumps.market;
    market.factory = ctx.accounts.factory.key();
    market.mint = ctx.accounts.mint.key();
    market.creator = ctx.accounts.creator.key();
    market.identifier = identifier;
    market.identifier_len = identifier_len;
    market.asset_class = asset_class;
    market.base_virtual_sol = base_virtual_sol;
    market.virtual_token_supply = virtual_token_supply;
    market.real_sol_reserves = 0;
    market.tokens_minted = 0;
    market.created_at = clock.unix_timestamp;
    market.mindshare_oracle = ctx.accounts.oracle.key();

    let oracle = &mut ctx.accounts.oracle;
    oracle.bump = ctx.bumps.oracle;
    oracle.market = market.key();
    oracle.authority = ctx.accounts.oracle_authority.key();
    oracle.current_mindshare_bps = 0;
    oracle.peak_mindshare_bps = 0;
    oracle.ratchet_multiplier_bps = RATCHET_BASE_BPS;
    oracle.elasticity_bps = elasticity_bps;
    oracle.last_update_slot = clock.slot;
    oracle.last_update_unix = clock.unix_timestamp;
    oracle.min_update_interval_secs = MIN_UPDATE_INTERVAL_SECS;
    oracle.update_count = 0;

    ctx.accounts.factory.market_count = ctx.accounts
        .factory
        .market_count
        .checked_add(1)
        .ok_or(TredieError::MathOverflow)?;

    emit!(MarketCreated {
        market: market.key(),
        mint: ctx.accounts.mint.key(),
        identifier,
        identifier_len,
        asset_class,
        creator: ctx.accounts.creator.key(),
        created_at: clock.unix_timestamp,
    });

    Ok(())
}
