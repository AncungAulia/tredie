pub const DEFAULT_BASE_VIRTUAL_SOL: u64 = 30_000_000_000; // 30 SOL in lamports
pub const DEFAULT_VIRTUAL_TOKEN_SUPPLY: u64 = 1_000_000_000_000_000; // 1B × 10^6

pub const RATCHET_BASE_BPS: u32 = 10_000; // 1.0x
pub const MAX_RATCHET_BPS: u32 = 50_000; // 5.0x cap
pub const DEFAULT_ELASTICITY_BPS: u32 = 5_000;

pub const MINDSHARE_BPS_MAX: u32 = 100_000;
pub const MIN_UPDATE_INTERVAL_SECS: i64 = 300;

pub const MARKET_TOKEN_DECIMALS: u8 = 6;

// Market PDA doubles as the vault (holds real SOL) and mint authority.
// This removes the need for separate vault + mint_auth PDAs.
pub const FACTORY_SEED: &[u8] = b"factory";
pub const MARKET_SEED: &[u8] = b"market";
pub const ORACLE_SEED: &[u8] = b"oracle";

pub const IDENTIFIER_MAX_LEN: usize = 32;
pub const PROTOCOL_FEE_BPS: u16 = 100; // 1%
