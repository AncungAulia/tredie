use anchor_lang::prelude::*;

#[error_code]
pub enum TredieError {
    #[msg("Amount must be greater than zero")]
    InvalidAmount,
    #[msg("Slippage tolerance exceeded")]
    SlippageExceeded,
    #[msg("Factory is paused")]
    FactoryPaused,
    #[msg("Oracle update interval not elapsed (min 5 min)")]
    UpdateIntervalNotElapsed,
    #[msg("Mindshare bps exceeds maximum of 100_000")]
    MindshareOutOfBounds,
    #[msg("Signer is not the oracle authority")]
    Unauthorized,
    #[msg("Insufficient SOL reserves in market")]
    InsufficientReserves,
    #[msg("Asset class must be 0-5")]
    InvalidAssetClass,
    #[msg("Identifier is empty or exceeds 44 bytes")]
    InvalidIdentifier,
    #[msg("Math overflow")]
    MathOverflow,
    #[msg("Protocol fee exceeds input amount")]
    FeeExceedsAmount,
    #[msg("Trade produces zero tokens — increase input amount")]
    ZeroTokenOutput,
    #[msg("Elasticity bps must be <= 20_000")]
    InvalidElasticity,
}
