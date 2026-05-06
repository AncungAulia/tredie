use anchor_lang::prelude::*;

/// Market PDA serves as both the SOL vault and the SPL mint authority.
/// real_sol_reserves tracks curve SOL only (after fees); the account's
/// lamports = rent_exempt_min + real_sol_reserves.
#[account]
#[derive(InitSpace)]
pub struct Market {
    pub bump: u8,
    pub factory: Pubkey,
    pub mint: Pubkey,
    pub creator: Pubkey,
    /// Raw identifier bytes, right-padded with zeros to 32 bytes.
    /// Pass a raw pubkey, or any UTF-8 string ≤ 32 bytes.
    pub identifier: [u8; 32],
    /// Actual byte length of identifier (1..=32).
    pub identifier_len: u8,
    /// 0=crypto 1=dex 2=equity 3=commodity 4=fx 5=CA
    pub asset_class: u8,
    pub base_virtual_sol: u64,
    pub virtual_token_supply: u64,
    pub real_sol_reserves: u64,
    pub tokens_minted: u64,
    pub created_at: i64,
    pub mindshare_oracle: Pubkey,
}
