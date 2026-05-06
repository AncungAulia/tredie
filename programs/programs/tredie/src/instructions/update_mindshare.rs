use anchor_lang::prelude::*;
use crate::{
    constants::*,
    errors::TredieError,
    events::MindshareUpdated,
    state::{Market, MindshareOracle},
};

#[derive(Accounts)]
pub struct UpdateMindshare<'info> {
    #[account(
        seeds = [MARKET_SEED, &market.identifier],
        bump = market.bump,
    )]
    pub market: Account<'info, Market>,

    /// `has_one` checks oracle.authority == authority.key().
    #[account(
        mut,
        seeds = [ORACLE_SEED, market.key().as_ref()],
        bump = oracle.bump,
        has_one = authority @ TredieError::Unauthorized,
    )]
    pub oracle: Account<'info, MindshareOracle>,

    pub authority: Signer<'info>,
}

pub(crate) fn handler(ctx: Context<UpdateMindshare>, new_mindshare_bps: u32) -> Result<()> {
    require!(
        new_mindshare_bps <= MINDSHARE_BPS_MAX,
        TredieError::MindshareOutOfBounds
    );

    let clock = Clock::get()?;
    let oracle = &mut ctx.accounts.oracle;

    require!(
        clock.unix_timestamp - oracle.last_update_unix >= oracle.min_update_interval_secs,
        TredieError::UpdateIntervalNotElapsed
    );

    oracle.current_mindshare_bps = new_mindshare_bps;

    // One-way ratchet: only moves up, never down.
    if new_mindshare_bps > oracle.peak_mindshare_bps {
        oracle.peak_mindshare_bps = new_mindshare_bps;

        // new_ratchet = 10_000 + (peak × elasticity / 10_000)
        let boost = (oracle.peak_mindshare_bps as u64)
            .checked_mul(oracle.elasticity_bps as u64)
            .ok_or(TredieError::MathOverflow)?
            .checked_div(10_000)
            .ok_or(TredieError::MathOverflow)?;

        let new_ratchet = (RATCHET_BASE_BPS as u64)
            .checked_add(boost)
            .ok_or(TredieError::MathOverflow)?;

        oracle.ratchet_multiplier_bps =
            (new_ratchet as u32).min(MAX_RATCHET_BPS);
    }

    oracle.last_update_slot = clock.slot;
    oracle.last_update_unix = clock.unix_timestamp;
    oracle.update_count = oracle
        .update_count
        .checked_add(1)
        .ok_or(TredieError::MathOverflow)?;

    emit!(MindshareUpdated {
        market: ctx.accounts.market.key(),
        current_bps: oracle.current_mindshare_bps,
        peak_bps: oracle.peak_mindshare_bps,
        ratchet_bps: oracle.ratchet_multiplier_bps,
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}
