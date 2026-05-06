use litesvm::LiteSVM;
use solana_sdk::{
    clock::Clock,
    instruction::{AccountMeta, Instruction},
    message::Message,
    pubkey::Pubkey,
    signature::{Keypair, Signer},
    sysvar,
    transaction::Transaction,
};

// ─── Program IDs ───────────────────────────────────────────────────────────────
const PROGRAM_ID: Pubkey = solana_sdk::pubkey!("EUAyjsbak9hRXPxU4zdDWwrL1Qy8RpwmfV9PNGKpdxBU");
const SPL_TOKEN_ID: Pubkey = solana_sdk::pubkey!("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const SPL_ATA_ID: Pubkey = solana_sdk::pubkey!("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
const SYSTEM_PROGRAM_ID: Pubkey = solana_sdk::pubkey!("11111111111111111111111111111111");

// ─── Core helpers ──────────────────────────────────────────────────────────────

fn discriminator(ix_name: &str) -> [u8; 8] {
    use solana_sdk::hash::hash;
    hash(format!("global:{ix_name}").as_bytes()).to_bytes()[..8]
        .try_into()
        .unwrap()
}

fn make_svm() -> LiteSVM {
    let manifest = std::path::Path::new(env!("CARGO_MANIFEST_DIR"));
    let fixtures = manifest.join("tests/fixtures");
    let deploy = manifest.join("../../target/deploy");

    let mut svm = LiteSVM::new();
    svm.add_program(
        SPL_TOKEN_ID,
        &std::fs::read(fixtures.join("spl_token.so")).expect("tests/fixtures/spl_token.so missing"),
    )
    .expect("add spl_token");
    svm.add_program(
        SPL_ATA_ID,
        &std::fs::read(fixtures.join("spl_associated_token_account.so"))
            .expect("tests/fixtures/spl_associated_token_account.so missing"),
    )
    .expect("add spl_ata");
    svm.add_program_from_file(PROGRAM_ID, deploy.join("tredie.so"))
        .expect("target/deploy/tredie.so missing — run `anchor build`");
    svm
}

fn factory_pda() -> (Pubkey, u8) {
    Pubkey::find_program_address(&[b"factory"], &PROGRAM_ID)
}

fn market_pda(id: &[u8; 32]) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[b"market", id.as_ref()], &PROGRAM_ID)
}

fn oracle_pda(market: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[b"oracle", market.as_ref()], &PROGRAM_ID)
}

fn ata(wallet: &Pubkey, mint: &Pubkey) -> Pubkey {
    Pubkey::find_program_address(
        &[wallet.as_ref(), SPL_TOKEN_ID.as_ref(), mint.as_ref()],
        &SPL_ATA_ID,
    )
    .0
}

fn make_id(s: &str) -> ([u8; 32], u8) {
    let bytes = s.as_bytes();
    let len = bytes.len().min(32) as u8;
    let mut id = [0u8; 32];
    id[..len as usize].copy_from_slice(&bytes[..len as usize]);
    (id, len)
}

type TxResult = litesvm::types::TransactionResult;

fn send(svm: &mut LiteSVM, payer: &Keypair, signers: &[&Keypair], ixs: &[Instruction]) -> TxResult {
    let bh = svm.latest_blockhash();
    let msg = Message::new_with_blockhash(ixs, Some(&payer.pubkey()), &bh);
    let mut tx = Transaction::new_unsigned(msg);
    tx.sign(signers, bh);
    svm.send_transaction(tx)
}

// ─── Instruction builders ──────────────────────────────────────────────────────

fn ix_init_factory(authority: &Pubkey, fee_recipient: &Pubkey, fee_bps: u16) -> Instruction {
    let (factory, _) = factory_pda();
    let mut data = discriminator("init_factory").to_vec();
    data.extend_from_slice(&fee_bps.to_le_bytes());
    Instruction {
        program_id: PROGRAM_ID,
        accounts: vec![
            AccountMeta::new(factory, false),
            AccountMeta::new(*authority, true),
            AccountMeta::new_readonly(*fee_recipient, false),
            AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),
        ],
        data,
    }
}

fn ix_create_market(
    creator: &Pubkey,
    mint: &Pubkey,
    oracle_auth: &Pubkey,
    id: [u8; 32],
    id_len: u8,
    asset_class: u8,
    base_vsol: u64,
    vtokens: u64,
    elasticity_bps: u32,
) -> Instruction {
    let (factory, _) = factory_pda();
    let (market, _) = market_pda(&id);
    let (oracle, _) = oracle_pda(&market);
    let mut data = discriminator("create_market").to_vec();
    data.extend_from_slice(&id);
    data.push(id_len);
    data.push(asset_class);
    data.extend_from_slice(&base_vsol.to_le_bytes());
    data.extend_from_slice(&vtokens.to_le_bytes());
    data.extend_from_slice(&elasticity_bps.to_le_bytes());
    Instruction {
        program_id: PROGRAM_ID,
        accounts: vec![
            AccountMeta::new(factory, false),
            AccountMeta::new(market, false),
            AccountMeta::new(*mint, true),  // init keypair account must sign
            AccountMeta::new(oracle, false),
            AccountMeta::new(*creator, true),
            AccountMeta::new_readonly(*oracle_auth, false),
            AccountMeta::new_readonly(SPL_TOKEN_ID, false),
            AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),
            AccountMeta::new_readonly(sysvar::rent::id(), false),
        ],
        data,
    }
}

fn ix_buy(
    buyer: &Pubkey,
    mint: &Pubkey,
    fee_recipient: &Pubkey,
    id: &[u8; 32],
    sol_in: u64,
    min_tokens_out: u64,
) -> Instruction {
    let (factory, _) = factory_pda();
    let (market, _) = market_pda(id);
    let (oracle, _) = oracle_pda(&market);
    let buyer_ata = ata(buyer, mint);
    let mut data = discriminator("buy").to_vec();
    data.extend_from_slice(&sol_in.to_le_bytes());
    data.extend_from_slice(&min_tokens_out.to_le_bytes());
    Instruction {
        program_id: PROGRAM_ID,
        accounts: vec![
            AccountMeta::new_readonly(factory, false),
            AccountMeta::new(market, false),
            AccountMeta::new(*mint, false),
            AccountMeta::new_readonly(oracle, false),
            AccountMeta::new(buyer_ata, false),
            AccountMeta::new(*fee_recipient, false),
            AccountMeta::new(*buyer, true),
            AccountMeta::new_readonly(SPL_TOKEN_ID, false),
            AccountMeta::new_readonly(SPL_ATA_ID, false),
            AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),
        ],
        data,
    }
}

fn ix_sell(
    seller: &Pubkey,
    mint: &Pubkey,
    fee_recipient: &Pubkey,
    id: &[u8; 32],
    tokens_in: u64,
    min_sol_out: u64,
) -> Instruction {
    let (factory, _) = factory_pda();
    let (market, _) = market_pda(id);
    let (oracle, _) = oracle_pda(&market);
    let seller_ata = ata(seller, mint);
    let mut data = discriminator("sell").to_vec();
    data.extend_from_slice(&tokens_in.to_le_bytes());
    data.extend_from_slice(&min_sol_out.to_le_bytes());
    Instruction {
        program_id: PROGRAM_ID,
        accounts: vec![
            AccountMeta::new_readonly(factory, false),
            AccountMeta::new(market, false),
            AccountMeta::new(*mint, false),
            AccountMeta::new_readonly(oracle, false),
            AccountMeta::new(seller_ata, false),
            AccountMeta::new(*fee_recipient, false),
            AccountMeta::new(*seller, true),
            AccountMeta::new_readonly(SPL_TOKEN_ID, false),
            AccountMeta::new_readonly(SPL_ATA_ID, false),
            AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),
        ],
        data,
    }
}

fn ix_update_mindshare(auth: &Pubkey, id: &[u8; 32], new_bps: u32) -> Instruction {
    let (market, _) = market_pda(id);
    let (oracle, _) = oracle_pda(&market);
    let mut data = discriminator("update_mindshare").to_vec();
    data.extend_from_slice(&new_bps.to_le_bytes());
    Instruction {
        program_id: PROGRAM_ID,
        accounts: vec![
            AccountMeta::new_readonly(market, false),
            AccountMeta::new(oracle, false),
            AccountMeta::new(*auth, true),
        ],
        data,
    }
}

// ─── Token account helpers ─────────────────────────────────────────────────────

fn token_balance(svm: &LiteSVM, ata: &Pubkey) -> u64 {
    // SPL TokenAccount layout: mint(32) owner(32) amount(8) …
    let raw = svm.get_account(ata).expect("ATA not found");
    u64::from_le_bytes(raw.data[64..72].try_into().unwrap())
}

/// Pre-create the ATA so that buy's `init_if_needed` finds it already existing
/// and skips the CPI, which avoids an UnbalancedInstruction edge case in litesvm.
fn ensure_ata(svm: &mut LiteSVM, payer: &Keypair, mint: &Pubkey, owner: &Pubkey) -> Pubkey {
    let ata_addr = ata(owner, mint);
    if svm.get_account(&ata_addr).is_some() {
        return ata_addr;
    }
    // ATA program Create instruction:
    // [payer(w,s), ata(w), owner(ro), mint(ro), system_prog(ro), token_prog(ro)]
    let ix = Instruction {
        program_id: SPL_ATA_ID,
        accounts: vec![
            AccountMeta::new(payer.pubkey(), true),
            AccountMeta::new(ata_addr, false),
            AccountMeta::new_readonly(*owner, false),
            AccountMeta::new_readonly(*mint, false),
            AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),
            AccountMeta::new_readonly(SPL_TOKEN_ID, false),
        ],
        data: vec![],
    };
    send(svm, payer, &[payer], &[ix]).expect("ensure_ata: ATA creation failed");
    ata_addr
}

// ─── Shared setup (factory + optional market) ──────────────────────────────────

struct Env {
    svm: LiteSVM,
    authority: Keypair,
    fee_recipient: Keypair,
}

impl Env {
    fn new() -> Self {
        let mut svm = make_svm();
        let authority = Keypair::new();
        let fee_recipient = Keypair::new();
        svm.airdrop(&authority.pubkey(), 100_000_000_000).unwrap();
        send(
            &mut svm,
            &authority,
            &[&authority],
            &[ix_init_factory(&authority.pubkey(), &fee_recipient.pubkey(), 100)],
        )
        .expect("Env::new — init_factory failed");
        Self { svm, authority, fee_recipient }
    }

    fn create_market(&mut self, tag: &str, oracle_auth: &Pubkey) -> (Keypair, [u8; 32]) {
        let mint = Keypair::new();
        let (id, id_len) = make_id(tag);
        send(
            &mut self.svm,
            &self.authority,
            &[&self.authority, &mint],
            &[ix_create_market(
                &self.authority.pubkey(),
                &mint.pubkey(),
                oracle_auth,
                id,
                id_len,
                0,                        // asset_class = crypto
                30_000_000_000,           // 30 SOL base
                1_000_000_000_000_000,    // 1 B tokens (6 dec)
                5_000,                    // elasticity = 50 %
            )],
        )
        .expect("Env::create_market failed");
        (mint, id)
    }

    fn advance_time(&mut self, unix_timestamp: i64) {
        // Set clock sysvar so update_mindshare interval checks pass.
        self.svm.set_sysvar(&Clock {
            slot: unix_timestamp as u64 * 3, // ~3 slots/second approximation
            epoch_start_timestamp: 0,
            epoch: 0,
            leader_schedule_epoch: 1,
            unix_timestamp,
        });
    }
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

#[test]
fn test_init_factory_happy() {
    let mut svm = make_svm();
    let authority = Keypair::new();
    let fee_recipient = Keypair::new();
    svm.airdrop(&authority.pubkey(), 10_000_000_000).unwrap();

    send(
        &mut svm,
        &authority,
        &[&authority],
        &[ix_init_factory(&authority.pubkey(), &fee_recipient.pubkey(), 100)],
    )
    .expect("init_factory should succeed");

    let (factory, _) = factory_pda();
    let raw = svm.get_account(&factory).unwrap();
    // Layout: disc(8) bump(1) authority(32) fee_recipient(32) market_count(8) fee_bps(2) paused(1)
    let fee_bps = u16::from_le_bytes(raw.data[81..83].try_into().unwrap());
    assert_eq!(fee_bps, 100, "fee_bps should be stored as 100");
    assert_eq!(raw.data[83], 0, "factory should not be paused");
}

#[test]
fn test_init_factory_fee_cap() {
    let mut svm = make_svm();
    let authority = Keypair::new();
    let fee_recipient = Keypair::new();
    svm.airdrop(&authority.pubkey(), 10_000_000_000).unwrap();

    let result = send(
        &mut svm,
        &authority,
        &[&authority],
        &[ix_init_factory(&authority.pubkey(), &fee_recipient.pubkey(), 1001)],
    );
    assert!(result.is_err(), "fee_bps > 1000 must be rejected");
}

#[test]
fn test_create_market_happy() {
    let mut env = Env::new();
    let oracle_auth = Keypair::new();
    let (mint, id) = env.create_market("BTC-USD", &oracle_auth.pubkey());

    let (market, _) = market_pda(&id);
    let (oracle_addr, _) = oracle_pda(&market);

    assert!(env.svm.get_account(&market).is_some(), "market account must exist");
    assert!(env.svm.get_account(&mint.pubkey()).is_some(), "mint account must exist");

    let oracle_raw = env.svm.get_account(&oracle_addr).unwrap();
    // Layout: disc(8) bump(1) market(32) authority(32) current_bps(4) peak_bps(4) ratchet_bps(4)
    let ratchet = u32::from_le_bytes(oracle_raw.data[81..85].try_into().unwrap());
    assert_eq!(ratchet, 10_000, "initial ratchet must be 10_000 (1.0×)");
}

#[test]
fn test_create_market_invalid_identifier() {
    let mut env = Env::new();
    let oracle_auth = Keypair::new();
    let mint = Keypair::new();

    let result = send(
        &mut env.svm,
        &env.authority,
        &[&env.authority, &mint],
        &[ix_create_market(
            &env.authority.pubkey(),
            &mint.pubkey(),
            &oracle_auth.pubkey(),
            [0u8; 32],
            0, // identifier_len = 0 → InvalidIdentifier
            0,
            30_000_000_000,
            1_000_000_000_000_000,
            5_000,
        )],
    );
    assert!(result.is_err(), "identifier_len=0 must be rejected");
}

#[test]
fn test_identifier_collision() {
    let mut env = Env::new();
    let oracle_auth = Keypair::new();
    env.create_market("ETH-USD", &oracle_auth.pubkey());

    let mint2 = Keypair::new();
    let (id, id_len) = make_id("ETH-USD");
    let result = send(
        &mut env.svm,
        &env.authority,
        &[&env.authority, &mint2],
        &[ix_create_market(
            &env.authority.pubkey(),
            &mint2.pubkey(),
            &oracle_auth.pubkey(),
            id,
            id_len,
            0,
            30_000_000_000,
            1_000_000_000_000_000,
            5_000,
        )],
    );
    assert!(result.is_err(), "duplicate market identifier must be rejected");
}

#[test]
fn test_buy_happy() {
    let mut env = Env::new();
    let oracle_auth = Keypair::new();
    let (mint, id) = env.create_market("SOL-MS", &oracle_auth.pubkey());

    let buyer = Keypair::new();
    env.svm.airdrop(&buyer.pubkey(), 10_000_000_000).unwrap();

    let (market, _) = market_pda(&id);
    let market_sol_before = env.svm.get_account(&market).unwrap().lamports;

    ensure_ata(&mut env.svm, &buyer, &mint.pubkey(), &buyer.pubkey());
    send(
        &mut env.svm,
        &buyer,
        &[&buyer],
        &[ix_buy(&buyer.pubkey(), &mint.pubkey(), &env.fee_recipient.pubkey(), &id, 1_000_000_000, 0)],
    )
    .expect("buy should succeed");

    let market_sol_after = env.svm.get_account(&market).unwrap().lamports;
    assert!(market_sol_after > market_sol_before, "market lamports must increase after buy");

    let buyer_ata = ata(&buyer.pubkey(), &mint.pubkey());
    let balance = token_balance(&env.svm, &buyer_ata);
    assert!(balance > 0, "buyer should receive tokens");
}

#[test]
fn test_buy_zero_amount() {
    let mut env = Env::new();
    let oracle_auth = Keypair::new();
    let (mint, id) = env.create_market("ZERO-BUY", &oracle_auth.pubkey());

    let buyer = Keypair::new();
    env.svm.airdrop(&buyer.pubkey(), 1_000_000_000).unwrap();

    let result = send(
        &mut env.svm,
        &buyer,
        &[&buyer],
        &[ix_buy(&buyer.pubkey(), &mint.pubkey(), &env.fee_recipient.pubkey(), &id, 0, 0)],
    );
    assert!(result.is_err(), "buy 0 SOL must be rejected");
}

#[test]
fn test_buy_slippage() {
    let mut env = Env::new();
    let oracle_auth = Keypair::new();
    let (mint, id) = env.create_market("SLIP-BUY", &oracle_auth.pubkey());

    let buyer = Keypair::new();
    env.svm.airdrop(&buyer.pubkey(), 10_000_000_000).unwrap();

    let result = send(
        &mut env.svm,
        &buyer,
        &[&buyer],
        &[ix_buy(
            &buyer.pubkey(),
            &mint.pubkey(),
            &env.fee_recipient.pubkey(),
            &id,
            1_000_000_000,
            u64::MAX, // impossible min_tokens_out
        )],
    );
    assert!(result.is_err(), "impossible slippage must be rejected");
}

#[test]
fn test_sell_happy() {
    let mut env = Env::new();
    let oracle_auth = Keypair::new();
    let (mint, id) = env.create_market("SELL-TEST", &oracle_auth.pubkey());

    let trader = Keypair::new();
    env.svm.airdrop(&trader.pubkey(), 10_000_000_000).unwrap();

    // Buy first
    ensure_ata(&mut env.svm, &trader, &mint.pubkey(), &trader.pubkey());
    send(
        &mut env.svm,
        &trader,
        &[&trader],
        &[ix_buy(&trader.pubkey(), &mint.pubkey(), &env.fee_recipient.pubkey(), &id, 1_000_000_000, 0)],
    )
    .expect("buy before sell must succeed");

    let trader_ata = ata(&trader.pubkey(), &mint.pubkey());
    let balance_before = token_balance(&env.svm, &trader_ata);
    assert!(balance_before > 0, "must have tokens after buy");

    let market_sol_before = env.svm.get_account(&market_pda(&id).0).unwrap().lamports;

    send(
        &mut env.svm,
        &trader,
        &[&trader],
        &[ix_sell(
            &trader.pubkey(),
            &mint.pubkey(),
            &env.fee_recipient.pubkey(),
            &id,
            balance_before / 2, // sell half
            0,
        )],
    )
    .expect("sell should succeed");

    let balance_after = token_balance(&env.svm, &trader_ata);
    assert!(balance_after < balance_before, "token balance must decrease after sell");

    let market_sol_after = env.svm.get_account(&market_pda(&id).0).unwrap().lamports;
    assert!(market_sol_after < market_sol_before, "market SOL must decrease after sell");
}

#[test]
fn test_sell_slippage() {
    let mut env = Env::new();
    let oracle_auth = Keypair::new();
    let (mint, id) = env.create_market("SLIP-SELL", &oracle_auth.pubkey());

    let trader = Keypair::new();
    env.svm.airdrop(&trader.pubkey(), 10_000_000_000).unwrap();

    ensure_ata(&mut env.svm, &trader, &mint.pubkey(), &trader.pubkey());
    send(
        &mut env.svm,
        &trader,
        &[&trader],
        &[ix_buy(&trader.pubkey(), &mint.pubkey(), &env.fee_recipient.pubkey(), &id, 1_000_000_000, 0)],
    )
    .unwrap();

    let balance = token_balance(&env.svm, &ata(&trader.pubkey(), &mint.pubkey()));

    let result = send(
        &mut env.svm,
        &trader,
        &[&trader],
        &[ix_sell(
            &trader.pubkey(),
            &mint.pubkey(),
            &env.fee_recipient.pubkey(),
            &id,
            balance,
            u64::MAX, // impossible min_sol_out
        )],
    );
    assert!(result.is_err(), "impossible sell slippage must be rejected");
}

#[test]
fn test_update_mindshare_unauthorized() {
    let mut env = Env::new();
    let oracle_auth = Keypair::new();
    let (_, id) = env.create_market("AUTH-TEST", &oracle_auth.pubkey());

    let wrong = Keypair::new();
    env.svm.airdrop(&wrong.pubkey(), 1_000_000_000).unwrap();
    env.advance_time(86_400); // advance to pass interval (auth check fires first anyway)

    let result = send(
        &mut env.svm,
        &wrong,
        &[&wrong],
        &[ix_update_mindshare(&wrong.pubkey(), &id, 5_000)],
    );
    assert!(result.is_err(), "wrong oracle authority must be rejected");
}

#[test]
fn test_update_mindshare_interval_enforcement() {
    let mut env = Env::new();
    let oracle_auth = Keypair::new();
    env.svm.airdrop(&oracle_auth.pubkey(), 1_000_000_000).unwrap();
    let (_, id) = env.create_market("INTERVAL", &oracle_auth.pubkey());

    // First update — advance time past 300 s minimum
    env.advance_time(86_400);
    send(
        &mut env.svm,
        &oracle_auth,
        &[&oracle_auth],
        &[ix_update_mindshare(&oracle_auth.pubkey(), &id, 5_000)],
    )
    .expect("first update should succeed");

    // Second update at the same timestamp → interval not elapsed
    let result = send(
        &mut env.svm,
        &oracle_auth,
        &[&oracle_auth],
        &[ix_update_mindshare(&oracle_auth.pubkey(), &id, 6_000)],
    );
    assert!(result.is_err(), "update too soon must be rejected");
}

#[test]
fn test_ratchet_one_way() {
    let mut env = Env::new();
    let oracle_auth = Keypair::new();
    env.svm.airdrop(&oracle_auth.pubkey(), 1_000_000_000).unwrap();
    let (_, id) = env.create_market("RATCHET", &oracle_auth.pubkey());

    let (market, _) = market_pda(&id);
    let (oracle_addr, _) = oracle_pda(&market);

    // First update: peak = 50_000 bps
    // Expected: ratchet = 10_000 + (50_000 × 5_000 / 10_000) = 35_000
    env.advance_time(86_400);
    send(
        &mut env.svm,
        &oracle_auth,
        &[&oracle_auth],
        &[ix_update_mindshare(&oracle_auth.pubkey(), &id, 50_000)],
    )
    .expect("first mindshare update");

    let ratchet_at_peak = u32::from_le_bytes(
        env.svm.get_account(&oracle_addr).unwrap().data[81..85].try_into().unwrap(),
    );
    assert_eq!(ratchet_at_peak, 35_000, "ratchet after 50% mindshare should be 35_000");

    // Second update: mindshare drops — ratchet must stay at 35_000
    env.advance_time(172_800);
    send(
        &mut env.svm,
        &oracle_auth,
        &[&oracle_auth],
        &[ix_update_mindshare(&oracle_auth.pubkey(), &id, 10_000)],
    )
    .expect("second mindshare update");

    let ratchet_after_drop = u32::from_le_bytes(
        env.svm.get_account(&oracle_addr).unwrap().data[81..85].try_into().unwrap(),
    );
    assert_eq!(
        ratchet_after_drop, 35_000,
        "ratchet must not decrease when mindshare drops — it is one-way"
    );
}

#[test]
fn test_buy_cheaper_before_ratchet() {
    // Verify the bonding curve: higher ratchet → higher price → fewer tokens per SOL.
    // Two separate trader keypairs avoid duplicate-transaction rejection when the
    // same buy parameters are used on the same pool after a sell-reset.
    let mut env = Env::new();
    let oracle_auth = Keypair::new();
    env.svm.airdrop(&oracle_auth.pubkey(), 1_000_000_000).unwrap();
    let (mint, id) = env.create_market("PRICE-TEST", &oracle_auth.pubkey());

    let trader_a = Keypair::new(); // buys before ratchet
    let trader_b = Keypair::new(); // buys after ratchet
    env.svm.airdrop(&trader_a.pubkey(), 50_000_000_000).unwrap();
    env.svm.airdrop(&trader_b.pubkey(), 50_000_000_000).unwrap();

    ensure_ata(&mut env.svm, &trader_a, &mint.pubkey(), &trader_a.pubkey());

    // --- Buy 1 SOL before ratchet (ratchet = 10_000 = 1.0×, baseline price) ---
    send(
        &mut env.svm,
        &trader_a,
        &[&trader_a],
        &[ix_buy(&trader_a.pubkey(), &mint.pubkey(), &env.fee_recipient.pubkey(), &id, 1_000_000_000, 0)],
    )
    .unwrap();
    let tokens_at_baseline = token_balance(&env.svm, &ata(&trader_a.pubkey(), &mint.pubkey()));

    // Sell all tokens to reset pool back to near-zero reserves.
    send(
        &mut env.svm,
        &trader_a,
        &[&trader_a],
        &[ix_sell(
            &trader_a.pubkey(), &mint.pubkey(), &env.fee_recipient.pubkey(),
            &id, tokens_at_baseline, 0,
        )],
    )
    .unwrap();

    // --- Apply large ratchet (peak = 100_000 → ratchet = 5.0×) ---
    env.advance_time(86_400);
    send(
        &mut env.svm,
        &oracle_auth,
        &[&oracle_auth],
        &[ix_update_mindshare(&oracle_auth.pubkey(), &id, 100_000)],
    )
    .unwrap();

    // --- Buy same 1 SOL after 5× ratchet with a different trader ---
    ensure_ata(&mut env.svm, &trader_b, &mint.pubkey(), &trader_b.pubkey());
    send(
        &mut env.svm,
        &trader_b,
        &[&trader_b],
        &[ix_buy(&trader_b.pubkey(), &mint.pubkey(), &env.fee_recipient.pubkey(), &id, 1_000_000_000, 0)],
    )
    .unwrap();
    let tokens_at_5x = token_balance(&env.svm, &ata(&trader_b.pubkey(), &mint.pubkey()));

    assert!(
        tokens_at_5x < tokens_at_baseline,
        "same SOL must buy fewer tokens after ratchet (price went up): \
         baseline={tokens_at_baseline} 5×_ratchet={tokens_at_5x}",
    );
}
