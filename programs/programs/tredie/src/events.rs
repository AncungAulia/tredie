use anchor_lang::prelude::*;

#[event]
pub struct MarketCreated {
    pub market: Pubkey,
    pub mint: Pubkey,
    pub identifier: [u8; 32],
    pub identifier_len: u8,
    pub asset_class: u8,
    pub creator: Pubkey,
    pub created_at: i64,
}

#[event]
pub struct MindshareUpdated {
    pub market: Pubkey,
    pub current_bps: u32,
    pub peak_bps: u32,
    pub ratchet_bps: u32,
    pub timestamp: i64,
}

#[event]
pub struct Trade {
    pub market: Pubkey,
    pub side: u8, // 0 = buy, 1 = sell
    pub sol_amount: u64,
    pub token_amount: u64,
    pub ratchet_bps: u32,
    pub trader: Pubkey,
    pub timestamp: i64,
}
