use anchor_lang::prelude::*;
use anchor_lang::solana_program::{
    instruction::{AccountMeta, Instruction},
    program::invoke_signed,
};
use anchor_lang::system_program::System;
use anchor_spl::token::{Mint, Token};
use crate::{
    constants::*,
    errors::TredieError,
    events::MarketCreated,
    state::{MarketFactory, Market, MindshareOracle},
};

// MPL Token Metadata program ID (canonical, stable on mainnet + devnet)
const TOKEN_METADATA_PROGRAM_ID: Pubkey =
    pubkey!("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");

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

    /// Market PDA doubles as vault (holds real SOL) and mint authority.
    /// PDA uniqueness prevents duplicate market races per identifier.
    #[account(
        init,
        payer = creator,
        space = 8 + Market::INIT_SPACE,
        seeds = [MARKET_SEED, &identifier],
        bump,
    )]
    pub market: Account<'info, Market>,

    /// SPL mint; authority = market PDA (no separate mint_auth PDA needed).
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

    /// CHECK: Arbitrary pubkey validated only when update_mindshare is called.
    pub oracle_authority: UncheckedAccount<'info>,

    /// CHECK: Metaplex metadata PDA; seeds and ownership validated by the metadata CPI.
    #[account(
        mut,
        seeds = [
            b"metadata",
            TOKEN_METADATA_PROGRAM_ID.as_ref(),
            mint.key().as_ref(),
        ],
        seeds::program = TOKEN_METADATA_PROGRAM_ID,
        bump,
    )]
    pub metadata_account: UncheckedAccount<'info>,

    /// CHECK: Constrained to the canonical MPL Token Metadata program address.
    #[account(address = TOKEN_METADATA_PROGRAM_ID)]
    pub token_metadata_program: UncheckedAccount<'info>,

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
    name: String,
    uri: String,
) -> Result<()> {
    require!(
        identifier_len > 0 && identifier_len as usize <= IDENTIFIER_MAX_LEN,
        TredieError::InvalidIdentifier
    );
    require!(asset_class <= 5, TredieError::InvalidAssetClass);
    require!(base_virtual_sol > 0, TredieError::InvalidAmount);
    require!(virtual_token_supply > 0, TredieError::InvalidAmount);
    require!(elasticity_bps <= 20_000, TredieError::InvalidElasticity);

    let clock = Clock::get()?;
    let market_bump = ctx.bumps.market;

    {
        let market = &mut ctx.accounts.market;
        market.bump = market_bump;
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
    }

    {
        let oracle = &mut ctx.accounts.oracle;
        oracle.bump = ctx.bumps.oracle;
        oracle.market = ctx.accounts.market.key();
        oracle.authority = ctx.accounts.oracle_authority.key();
        oracle.current_mindshare_bps = 0;
        oracle.peak_mindshare_bps = 0;
        oracle.ratchet_multiplier_bps = RATCHET_BASE_BPS;
        oracle.elasticity_bps = elasticity_bps;
        oracle.last_update_slot = clock.slot;
        oracle.last_update_unix = clock.unix_timestamp;
        oracle.min_update_interval_secs = MIN_UPDATE_INTERVAL_SECS;
        oracle.update_count = 0;
    }

    ctx.accounts.factory.market_count = ctx.accounts
        .factory
        .market_count
        .checked_add(1)
        .ok_or(TredieError::MathOverflow)?;

    // Derive symbol from identifier bytes (UTF-8 best-effort)
    let symbol = std::str::from_utf8(&identifier[..identifier_len as usize])
        .unwrap_or("???")
        .to_string();

    // Raw CPI to CreateMetadataAccountsV3 (discriminant 33 in mpl-token-metadata v3 on-chain)
    // Avoids mpl-token-metadata crate dependency conflicts with anchor-spl 1.0.2
    let mut ix_data = vec![33u8]; // CreateMetadataAccountsV3
    // DataV2 (Borsh) — name, symbol, uri, seller_fee_bps, creators, collection, uses
    for s in [name.as_str(), symbol.as_str(), uri.as_str()] {
        ix_data.extend_from_slice(&(s.len() as u32).to_le_bytes());
        ix_data.extend_from_slice(s.as_bytes());
    }
    ix_data.extend_from_slice(&0u16.to_le_bytes()); // seller_fee_basis_points = 0
    ix_data.push(0); // creators = None
    ix_data.push(0); // collection = None
    ix_data.push(0); // uses = None
    ix_data.push(0); // is_mutable = false
    ix_data.push(0); // collection_details = None

    let ix = Instruction {
        program_id: TOKEN_METADATA_PROGRAM_ID,
        accounts: vec![
            AccountMeta::new(ctx.accounts.metadata_account.key(), false),
            AccountMeta::new_readonly(ctx.accounts.mint.key(), false),
            AccountMeta::new_readonly(ctx.accounts.market.key(), true), // mint_authority PDA signer
            AccountMeta::new(ctx.accounts.creator.key(), true),         // payer
            AccountMeta::new_readonly(ctx.accounts.market.key(), false), // update_authority (PDA, no sign needed)
            AccountMeta::new_readonly(ctx.accounts.system_program.key(), false),
            AccountMeta::new_readonly(ctx.accounts.rent.key(), false),
        ],
        data: ix_data,
    };

    let bump_bytes = [market_bump];
    let signer_seeds: &[&[u8]] = &[MARKET_SEED, &identifier, &bump_bytes];

    invoke_signed(
        &ix,
        &[
            ctx.accounts.metadata_account.to_account_info(),
            ctx.accounts.mint.to_account_info(),
            ctx.accounts.market.to_account_info(),
            ctx.accounts.creator.to_account_info(),
            ctx.accounts.system_program.to_account_info(),
            ctx.accounts.rent.to_account_info(),
            ctx.accounts.token_metadata_program.to_account_info(),
        ],
        &[signer_seeds],
    )?;

    emit!(MarketCreated {
        market: ctx.accounts.market.key(),
        mint: ctx.accounts.mint.key(),
        identifier,
        identifier_len,
        asset_class,
        creator: ctx.accounts.creator.key(),
        created_at: clock.unix_timestamp,
    });

    Ok(())
}
