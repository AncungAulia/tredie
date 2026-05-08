/**
 * Server-side mirror of the on-chain AMM curve. Used for trade estimates
 * and to derive `min_tokens_out` / `min_sol_out` slippage protection before
 * we call buildBuyTx / buildSellTx.
 *
 * The math here MUST match programs/programs/tredie/src/instructions/buy.rs
 * and sell.rs exactly, otherwise estimates will diverge from on-chain reality.
 *
 * Constant-product AMM with virtual reserves:
 *   pool_sol    = base_virtual_sol + real_sol_reserves
 *   pool_tokens = virtual_token_supply - tokens_minted
 *   k           = pool_sol * pool_tokens
 *
 * Buy:
 *   fee            = sol_in * fee_bps / 10000
 *   sol_after_fee  = sol_in - fee
 *   new_pool_sol   = pool_sol + sol_after_fee
 *   new_pool_tok   = k / new_pool_sol      (integer division)
 *   tokens_out     = pool_tokens - new_pool_tok
 *
 * Sell:
 *   new_pool_tok      = pool_tokens + tokens_in
 *   new_pool_sol      = k / new_pool_tok    (integer division)
 *   sol_before_fee    = min(pool_sol - new_pool_sol, real_sol_reserves)
 *   fee               = sol_before_fee * fee_bps / 10000
 *   sol_to_seller     = sol_before_fee - fee
 */

import { PublicKey } from "@solana/web3.js";
import { connection } from "../solana/connection";
import { factoryPda } from "../solana/pda";
import { decodeFactory } from "../solana/decoder";
import { log } from "../utils/log";

interface FeeCacheEntry {
  feeBps: number;
  fetchedAt: number;
}

let feeCache: FeeCacheEntry | null = null;
const FEE_CACHE_TTL_MS = 60_000;

/** Resolve current protocol fee from on-chain factory, cached 60s. */
export async function getProtocolFeeBps(): Promise<number> {
  const now = Date.now();
  if (feeCache && now - feeCache.fetchedAt < FEE_CACHE_TTL_MS) {
    return feeCache.feeBps;
  }
  const [factory] = factoryPda();
  const acc = await connection.getAccountInfo(factory);
  if (!acc) {
    log.warn("Factory account missing — fee defaults to 100 bps");
    return 100;
  }
  try {
    const decoded = decodeFactory(acc.data);
    feeCache = { feeBps: decoded.feeBasisPoints, fetchedAt: now };
    return decoded.feeBasisPoints;
  } catch (e: any) {
    log.warn({ err: e?.message }, "Failed to decode factory, defaulting to 100 bps");
    return 100;
  }
}

export interface MarketCurveState {
  baseVirtualSol: bigint;
  virtualTokenSupply: bigint;
  realSolReserves: bigint;
  tokensMinted: bigint;
}

export interface BuyEstimate {
  /** SOL the user pays in (lamports). */
  solIn: bigint;
  /** Protocol fee deducted from solIn (lamports). */
  fee: bigint;
  /** Net SOL added to the pool (solIn - fee). */
  solAfterFee: bigint;
  /** Tokens delivered to the buyer (base units, i.e. accounting for decimals=6). */
  tokensOut: bigint;
  /** Effective price = solIn / tokensOut (lamports per token base unit). */
  effectivePrice: number;
  /** Spot price BEFORE the trade. */
  spotPriceBefore: number;
  /** Spot price AFTER the trade (slippage indicator). */
  spotPriceAfter: number;
  /** Price impact in bps: (effectivePrice - spotPriceBefore) / spotPriceBefore. */
  priceImpactBps: number;
}

export interface SellEstimate {
  tokensIn: bigint;
  /** SOL the seller receives (after fee), in lamports. */
  solOut: bigint;
  /** SOL pulled from the pool before fee. */
  solBeforeFee: bigint;
  fee: bigint;
  effectivePrice: number;
  spotPriceBefore: number;
  spotPriceAfter: number;
  priceImpactBps: number;
}

function spotPrice(poolSol: bigint, poolTokens: bigint): number {
  if (poolTokens === 0n) return 0;
  // lamports per token base unit; small enough to fit in Number.
  return Number(poolSol) / Number(poolTokens);
}

/** Compute buy output. Pure function — same math as buy.rs handler. */
export function estimateBuy(
  state: MarketCurveState,
  solIn: bigint,
  feeBps: number,
): BuyEstimate {
  if (solIn <= 0n) throw new Error("solIn must be > 0");

  const fee = (solIn * BigInt(feeBps)) / 10_000n;
  const solAfterFee = solIn - fee;
  if (solAfterFee <= 0n) throw new Error("Fee exceeds amount");

  const poolSol = state.baseVirtualSol + state.realSolReserves;
  const poolTokens = state.virtualTokenSupply - state.tokensMinted;
  if (poolTokens <= 0n) throw new Error("Insufficient token reserves");

  const k = poolSol * poolTokens;
  const newPoolSol = poolSol + solAfterFee;
  const newPoolTokens = k / newPoolSol;
  const tokensOut = poolTokens - newPoolTokens;

  if (tokensOut <= 0n) throw new Error("Zero token output");

  const spotBefore = spotPrice(poolSol, poolTokens);
  const spotAfter = spotPrice(newPoolSol, newPoolTokens);
  const effectivePrice = Number(solIn) / Number(tokensOut);
  const impactBps =
    spotBefore > 0 ? Math.round(((effectivePrice - spotBefore) / spotBefore) * 10_000) : 0;

  return {
    solIn,
    fee,
    solAfterFee,
    tokensOut,
    effectivePrice,
    spotPriceBefore: spotBefore,
    spotPriceAfter: spotAfter,
    priceImpactBps: impactBps,
  };
}

/** Compute sell output. Pure function — same math as sell.rs handler. */
export function estimateSell(
  state: MarketCurveState,
  tokensIn: bigint,
  feeBps: number,
): SellEstimate {
  if (tokensIn <= 0n) throw new Error("tokensIn must be > 0");

  const poolSol = state.baseVirtualSol + state.realSolReserves;
  const poolTokens = state.virtualTokenSupply - state.tokensMinted;
  if (poolTokens <= 0n) throw new Error("Insufficient token reserves");

  const k = poolSol * poolTokens;
  const newPoolTokens = poolTokens + tokensIn;
  const newPoolSol = k / newPoolTokens;
  const rawSolOut = poolSol - newPoolSol;

  // SC caps sol_before_fee at real_sol_reserves to avoid 1-lamport overshoot from
  // integer division when selling exactly what was previously bought.
  const solBeforeFee =
    rawSolOut > state.realSolReserves ? state.realSolReserves : rawSolOut;

  if (solBeforeFee <= 0n) throw new Error("Zero SOL output");

  const fee = (solBeforeFee * BigInt(feeBps)) / 10_000n;
  const solOut = solBeforeFee - fee;
  if (solOut <= 0n) throw new Error("Fee exceeds amount");

  const spotBefore = spotPrice(poolSol, poolTokens);
  const spotAfter = spotPrice(newPoolSol, newPoolTokens);
  const effectivePrice = Number(solBeforeFee) / Number(tokensIn);
  const impactBps =
    spotBefore > 0 ? Math.round(((spotBefore - effectivePrice) / spotBefore) * 10_000) : 0;

  return {
    tokensIn,
    solOut,
    solBeforeFee,
    fee,
    effectivePrice,
    spotPriceBefore: spotBefore,
    spotPriceAfter: spotAfter,
    priceImpactBps: impactBps,
  };
}

/** Apply slippage tolerance to a quoted output. */
export function applySlippageMin(quoted: bigint, slippageBps: number): bigint {
  if (slippageBps <= 0) return quoted;
  return (quoted * BigInt(10_000 - slippageBps)) / 10_000n;
}
