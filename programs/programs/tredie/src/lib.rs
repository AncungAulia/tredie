use anchor_lang::prelude::*;

pub mod constants;
pub mod errors;
pub mod events;
pub mod instructions;
pub mod state;

// Re-export all pub items (including Anchor-generated __client_accounts_* modules)
// so the #[program] macro can resolve them from the crate root.
pub use instructions::buy::*;
pub use instructions::create_market::*;
pub use instructions::init_factory::*;
pub use instructions::sell::*;
pub use instructions::update_mindshare::*;

declare_id!("EUAyjsbak9hRXPxU4zdDWwrL1Qy8RpwmfV9PNGKpdxBU");

#[program]
pub mod tredie {
    use super::*;

    pub fn init_factory(ctx: Context<InitFactory>, fee_basis_points: u16) -> Result<()> {
        instructions::init_factory::handler(ctx, fee_basis_points)
    }

    pub fn create_market(
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
        instructions::create_market::handler(
            ctx,
            identifier,
            identifier_len,
            asset_class,
            base_virtual_sol,
            virtual_token_supply,
            elasticity_bps,
            name,
            uri,
        )
    }

    pub fn buy(ctx: Context<Buy>, sol_amount_in: u64, min_tokens_out: u64) -> Result<()> {
        instructions::buy::handler(ctx, sol_amount_in, min_tokens_out)
    }

    pub fn sell(ctx: Context<Sell>, tokens_in: u64, min_sol_out: u64) -> Result<()> {
        instructions::sell::handler(ctx, tokens_in, min_sol_out)
    }

    pub fn update_mindshare(
        ctx: Context<UpdateMindshare>,
        new_mindshare_bps: u32,
    ) -> Result<()> {
        instructions::update_mindshare::handler(ctx, new_mindshare_bps)
    }
}
