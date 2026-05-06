use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct MindshareOracle {
    pub bump: u8,
    pub market: Pubkey,
    /// Only this signer may call update_mindshare (backend signer key).
    pub authority: Pubkey,
    pub current_mindshare_bps: u32,
    pub peak_mindshare_bps: u32,
    /// Always >= RATCHET_BASE_BPS (10_000), never decreases.
    pub ratchet_multiplier_bps: u32,
    pub elasticity_bps: u32,
    pub last_update_slot: u64,
    pub last_update_unix: i64,
    pub min_update_interval_secs: i64,
    pub update_count: u64,
}
