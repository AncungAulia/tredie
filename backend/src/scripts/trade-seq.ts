/**
 * One-off: trade a sequence on a single market with 10s intervals.
 *
 * Usage: bun run src/scripts/trade-seq.ts <identifier>
 *
 * Sequence (per user request):
 *   1. Buy 2 SOL
 *   2. Sell tokens worth ~1 SOL out
 *   3. Buy 3 SOL
 *   4. Sell tokens worth ~2 SOL out
 *   5. Sell ALL remaining tokens
 *
 * 10s wait between every step. Backend signer is the trader.
 */

import {
  PublicKey,
  Transaction,
  SystemProgram,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { buildBuyTx, buildSellTx, sendAndConfirm } from "../solana/instructions";
import { signer } from "../solana/signer";
import { connection } from "../solana/connection";
import { marketPda } from "../solana/pda";
import { decodeMarket } from "../solana/decoder";
import * as db from "../db";

const ID = process.argv[2];
if (!ID) {
  console.error("Usage: bun run trade-seq.ts <identifier>");
  process.exit(1);
}

const FEE_BPS = 100; // factory protocol fee
const WAIT_MS = 10_000;

function fmt(lamports: bigint): string {
  return `${(Number(lamports) / 1e9).toFixed(6)} SOL`;
}
function fmtTokens(t: bigint): string {
  return `${(Number(t) / 1e6).toFixed(2)}T`; // decimals=6
}

interface CurveState {
  baseVirtualSol: bigint;
  virtualTokenSupply: bigint;
  realSolReserves: bigint;
  tokensMinted: bigint;
}

async function fetchCurveState(): Promise<CurveState> {
  const [pda] = marketPda(ID);
  const acc = await connection.getAccountInfo(pda);
  if (!acc) throw new Error(`Market ${ID} not found on-chain`);
  const m = decodeMarket(acc.data);
  return {
    baseVirtualSol: m.baseVirtualSol,
    virtualTokenSupply: m.virtualTokenSupply,
    realSolReserves: m.realSolReserves,
    tokensMinted: m.tokensMinted,
  };
}

/**
 * Compute tokens_in needed to receive `solOutTarget` lamports after fee.
 * Mirror of programs/.../sell.rs but solving for tokens_in given desired sol_to_seller.
 */
function tokensForSolOut(state: CurveState, solOutTarget: bigint): bigint {
  const poolSol = state.baseVirtualSol + state.realSolReserves;
  const poolTokens = state.virtualTokenSupply - state.tokensMinted;
  const k = poolSol * poolTokens;

  // sol_to_seller = sol_before_fee * (10000 - fee_bps) / 10000
  // → sol_before_fee = sol_to_seller * 10000 / (10000 - fee_bps), round up
  const num = solOutTarget * 10_000n;
  const den = BigInt(10_000 - FEE_BPS);
  const solBeforeFee = (num + den - 1n) / den;

  if (solBeforeFee > state.realSolReserves) {
    throw new Error(
      `cannot pull ${fmt(solOutTarget)} from pool — only ${fmt(state.realSolReserves)} reserves`,
    );
  }

  const newPoolSol = poolSol - solBeforeFee;
  // tokens_in such that k / (poolTokens + tokens_in) = newPoolSol
  // → poolTokens + tokens_in = k / newPoolSol (rounded up to overshoot)
  const newPoolTokens = (k + newPoolSol - 1n) / newPoolSol;
  return newPoolTokens - poolTokens;
}

async function getMintAndATA(): Promise<{ mint: PublicKey; ata: PublicKey }> {
  const market = await db.getMarketByIdentifier(ID);
  if (!market) throw new Error(`Market ${ID} not in DB`);
  const mint = new PublicKey(market.mint);
  const ata = await getAssociatedTokenAddress(mint, signer.publicKey);
  return { mint, ata };
}

async function ensureATA(mint: PublicKey, ata: PublicKey) {
  const info = await connection.getAccountInfo(ata);
  if (info) return;
  console.log(`  creating ATA ${ata.toBase58().slice(0, 12)}...`);
  const ix = createAssociatedTokenAccountInstruction(
    signer.publicKey,
    ata,
    signer.publicKey,
    mint,
  );
  const tx = new Transaction().add(ix);
  tx.feePayer = signer.publicKey;
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  await sendAndConfirm(tx);
}

async function tokenBalance(ata: PublicKey): Promise<bigint> {
  try {
    const r = await connection.getTokenAccountBalance(ata);
    return BigInt(r.value.amount);
  } catch {
    return 0n;
  }
}

async function buy(solAmount: number) {
  const solIn = BigInt(Math.floor(solAmount * 1e9));
  const { mint, ata } = await getMintAndATA();
  await ensureATA(mint, ata);

  const before = await tokenBalance(ata);
  console.log(`  pre-buy balance: ${fmtTokens(before)}`);

  const tx = await buildBuyTx({
    buyer: signer.publicKey,
    identifier: ID,
    mintPubkey: mint,
    solAmountIn: solIn,
    minTokensOut: 0n,
  });
  const sig = await sendAndConfirm(tx);
  console.log(`  ✓ buy tx: ${sig}`);

  // Confirm balance updated
  const after = await tokenBalance(ata);
  console.log(`  post-buy balance: ${fmtTokens(after)}  (Δ ${fmtTokens(after - before)})`);
}

async function sell(tokensIn: bigint) {
  const { mint, ata } = await getMintAndATA();
  const balance = await tokenBalance(ata);
  if (tokensIn > balance) {
    console.log(
      `  ⚠️ tokens_in ${fmtTokens(tokensIn)} > balance ${fmtTokens(balance)} — capping`,
    );
    tokensIn = balance;
  }
  if (tokensIn === 0n) {
    console.log(`  no tokens to sell`);
    return;
  }
  console.log(`  pre-sell balance: ${fmtTokens(balance)}`);

  const tx = await buildSellTx({
    seller: signer.publicKey,
    identifier: ID,
    mintPubkey: mint,
    tokensIn,
    minSolOut: 0n,
  });
  const sig = await sendAndConfirm(tx);
  console.log(`  ✓ sell tx: ${sig}`);

  const after = await tokenBalance(ata);
  console.log(`  post-sell balance: ${fmtTokens(after)}  (Δ ${fmtTokens(after - balance)})`);
}

async function wait(ms: number) {
  console.log(`  ... waiting ${ms / 1000}s ...`);
  await new Promise((r) => setTimeout(r, ms));
}

async function main() {
  console.log(`\n══ Trade sequence on "${ID}" ══`);
  console.log(`Trader: ${signer.publicKey.toBase58()}`);
  const balLamports = await connection.getBalance(signer.publicKey);
  console.log(`SOL balance: ${(balLamports / 1e9).toFixed(4)} SOL\n`);

  console.log("[1/5] BUY 2 SOL");
  await buy(2);
  await wait(WAIT_MS);

  console.log("\n[2/5] SELL tokens for ~1 SOL out");
  let state = await fetchCurveState();
  const t1 = tokensForSolOut(state, 1_000_000_000n);
  console.log(`  → need to sell ${fmtTokens(t1)} for 1 SOL`);
  await sell(t1);
  await wait(WAIT_MS);

  console.log("\n[3/5] BUY 3 SOL");
  await buy(3);
  await wait(WAIT_MS);

  console.log("\n[4/5] SELL tokens for ~2 SOL out");
  state = await fetchCurveState();
  const t2 = tokensForSolOut(state, 2_000_000_000n);
  console.log(`  → need to sell ${fmtTokens(t2)} for 2 SOL`);
  await sell(t2);
  await wait(WAIT_MS);

  console.log("\n[5/5] SELL ALL remaining");
  const { ata } = await getMintAndATA();
  const remaining = await tokenBalance(ata);
  console.log(`  remaining balance: ${fmtTokens(remaining)}`);
  await sell(remaining);

  console.log("\n══ Sequence complete ══");
  const finalSol = await connection.getBalance(signer.publicKey);
  console.log(`Final SOL balance: ${(finalSol / 1e9).toFixed(4)} SOL`);
  console.log(`Net: ${((finalSol - balLamports) / 1e9).toFixed(4)} SOL`);

  process.exit(0);
}

main().catch((e) => {
  console.error("FAILED:", e?.message ?? e);
  process.exit(1);
});
