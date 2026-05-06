use anchor_lang::prelude::*;
use anchor_lang::system_program::System;
use crate::{constants::*, errors::TredieError, state::MarketFactory};

#[derive(Accounts)]
pub struct InitFactory<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + MarketFactory::INIT_SPACE,
        seeds = [FACTORY_SEED],
        bump,
    )]
    pub factory: Account<'info, MarketFactory>,

    #[account(mut)]
    pub authority: Signer<'info>,

    /// CHECK: Stored as pubkey; receives protocol fees on each trade.
    pub fee_recipient: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

pub(crate) fn handler(ctx: Context<InitFactory>, fee_basis_points: u16) -> Result<()> {
    require!(fee_basis_points <= 1_000, TredieError::InvalidAmount); // cap at 10%

    let factory = &mut ctx.accounts.factory;
    factory.bump = ctx.bumps.factory;
    factory.authority = ctx.accounts.authority.key();
    factory.fee_recipient = ctx.accounts.fee_recipient.key();
    factory.market_count = 0;
    factory.fee_basis_points = fee_basis_points;
    factory.paused = false;

    msg!("Factory initialised. fee_bps={}", fee_basis_points);
    Ok(())
}
