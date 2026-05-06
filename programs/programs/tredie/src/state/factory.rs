use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct MarketFactory {
    pub bump: u8,
    pub authority: Pubkey,
    pub fee_recipient: Pubkey,
    pub market_count: u64,
    pub fee_basis_points: u16,
    pub paused: bool,
}
