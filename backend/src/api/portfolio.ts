import { Hono } from "hono";
import { z } from "zod";
import { sql } from "../db";

export const portfolioRoutes = new Hono();

const jsonSafe = (v: unknown): unknown =>
  JSON.parse(
    JSON.stringify(v, (_, x) => (typeof x === "bigint" ? x.toString() : x)),
  );

// Solana base58 pubkey check (32-44 chars).
const addressSchema = z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);

/**
 * GET /portfolio/:address
 *
 * Returns per-user positions, aggregate stats, and recent activity, all
 * derived from the `trades` table joined with `markets`.
 *
 * Notes on math (hackathon-grade approximation):
 * - tokens_held = sum(buys.token_amount) - sum(sells.token_amount)
 * - cost basis is averaged across all buys (not FIFO/LIFO lot tracking)
 * - realized PnL on a sell is approximated as:
 *     proceeds - (tokens_sold / tokens_bought) * sol_invested
 *   This is exact when avg cost basis is constant (single-buy + sell);
 *   diverges from true FIFO when entry prices vary.
 * - unrealized PnL = tokens_held * current_spot_price - (tokens_held / tokens_bought) * sol_invested
 */
portfolioRoutes.get("/:address", async (c) => {
  const parsed = addressSchema.safeParse(c.req.param("address"));
  if (!parsed.success) return c.json({ error: "Invalid Solana address" }, 400);
  const address = parsed.data;
  const limit = Math.min(Number(c.req.query("limit") ?? "200"), 500);

  // Per-market aggregation. We compute everything in a single query so we
  // don't N+1 across markets.
  const positions = await sql<
    {
      market_pda: string;
      identifier: string;
      display_name: string | null;
      asset_class: number;
      mint: string;
      base_virtual_sol: bigint;
      virtual_token_supply: bigint;
      real_sol_reserves: bigint;
      tokens_minted: bigint;
      current_mindshare_bps: number;
      ratchet_multiplier_bps: number;
      tokens_bought: bigint;
      tokens_sold: bigint;
      sol_invested: bigint;
      sol_received: bigint;
      first_buy_at: bigint | null;
      last_trade_at: bigint | null;
      buy_count: bigint;
      sell_count: bigint;
    }[]
  >`
    SELECT
      m.pda                   AS market_pda,
      m.identifier,
      m.display_name,
      m.asset_class,
      m.mint,
      m.base_virtual_sol,
      m.virtual_token_supply,
      m.real_sol_reserves,
      m.tokens_minted,
      m.current_mindshare_bps,
      m.ratchet_multiplier_bps,
      COALESCE(SUM(CASE WHEN t.side = 0 THEN t.token_amount ELSE 0 END), 0)::bigint AS tokens_bought,
      COALESCE(SUM(CASE WHEN t.side = 1 THEN t.token_amount ELSE 0 END), 0)::bigint AS tokens_sold,
      COALESCE(SUM(CASE WHEN t.side = 0 THEN t.sol_amount   ELSE 0 END), 0)::bigint AS sol_invested,
      COALESCE(SUM(CASE WHEN t.side = 1 THEN t.sol_amount   ELSE 0 END), 0)::bigint AS sol_received,
      MIN(CASE WHEN t.side = 0 THEN t.block_time END) AS first_buy_at,
      MAX(t.block_time) AS last_trade_at,
      COUNT(CASE WHEN t.side = 0 THEN 1 END)::bigint AS buy_count,
      COUNT(CASE WHEN t.side = 1 THEN 1 END)::bigint AS sell_count
    FROM trades t
    JOIN markets m ON m.pda = t.market_pda
    WHERE t.trader = ${address}
    GROUP BY m.pda, m.identifier, m.display_name, m.asset_class, m.mint,
             m.base_virtual_sol, m.virtual_token_supply, m.real_sol_reserves,
             m.tokens_minted, m.current_mindshare_bps, m.ratchet_multiplier_bps
    HAVING COUNT(*) > 0
    ORDER BY MAX(t.block_time) DESC
  `;

  const enrichedPositions = positions.map((p) => {
    const tokensBought = BigInt(p.tokens_bought);
    const tokensSold = BigInt(p.tokens_sold);
    const tokensHeld = tokensBought - tokensSold;
    const solInvested = BigInt(p.sol_invested);
    const solReceived = BigInt(p.sol_received);

    // Spot price from current curve (lamports per token base unit)
    const poolSol = BigInt(p.base_virtual_sol) + BigInt(p.real_sol_reserves);
    const poolTokens =
      BigInt(p.virtual_token_supply) - BigInt(p.tokens_minted);
    const spotPriceLamports =
      poolTokens > 0n ? Number(poolSol) / Number(poolTokens) : 0;

    const avgEntryPriceLamports =
      tokensBought > 0n ? Number(solInvested) / Number(tokensBought) : 0;

    // Realized: portion of sol_invested consumed by sells, deducted from sol_received.
    const realizedPnL =
      tokensBought > 0n
        ? solReceived - (solInvested * tokensSold) / tokensBought
        : solReceived;

    // Unrealized: held tokens valued at current spot, minus their proportional cost basis.
    const heldCostBasis =
      tokensBought > 0n ? (solInvested * tokensHeld) / tokensBought : 0n;
    const heldValueLamports = BigInt(
      Math.floor(Number(tokensHeld) * spotPriceLamports),
    );
    const unrealizedPnL = heldValueLamports - heldCostBasis;

    return {
      market_pda: p.market_pda,
      identifier: p.identifier,
      display_name: p.display_name,
      asset_class: p.asset_class,
      mint: p.mint,
      current_mindshare_bps: p.current_mindshare_bps,
      ratchet_multiplier_bps: p.ratchet_multiplier_bps,
      tokens_bought: tokensBought,
      tokens_sold: tokensSold,
      tokens_held: tokensHeld,
      sol_invested_lamports: solInvested,
      sol_received_lamports: solReceived,
      avg_entry_price_lamports: avgEntryPriceLamports,
      current_spot_price_lamports: spotPriceLamports,
      held_value_lamports: heldValueLamports,
      held_cost_basis_lamports: heldCostBasis,
      realized_pnl_lamports: realizedPnL,
      unrealized_pnl_lamports: unrealizedPnL,
      buy_count: p.buy_count,
      sell_count: p.sell_count,
      first_buy_at: p.first_buy_at,
      last_trade_at: p.last_trade_at,
    };
  });

  // Aggregate stats across all positions
  let totalTrades = 0;
  let buyCount = 0;
  let sellCount = 0;
  let totalVolume = 0n;
  let solSpent = 0n;
  let solReceived = 0n;
  let realizedPnL = 0n;
  let unrealizedPnL = 0n;
  let totalHeldValue = 0n;
  let closedTrades = 0;
  let winningClosed = 0;

  for (const p of enrichedPositions) {
    buyCount += Number(p.buy_count);
    sellCount += Number(p.sell_count);
    totalVolume += p.sol_invested_lamports + p.sol_received_lamports;
    solSpent += p.sol_invested_lamports;
    solReceived += p.sol_received_lamports;
    realizedPnL += p.realized_pnl_lamports;
    unrealizedPnL += p.unrealized_pnl_lamports;
    totalHeldValue += p.held_value_lamports;

    // Closed-trade win rate: a position is "closed" if tokens_held == 0 and
    // there was at least one sell. We count it as a win if realized > 0.
    if (p.tokens_held === 0n && p.sell_count > 0n) {
      closedTrades++;
      if (p.realized_pnl_lamports > 0n) winningClosed++;
    }
  }
  totalTrades = buyCount + sellCount;

  const winRateBps =
    closedTrades > 0 ? Math.round((winningClosed / closedTrades) * 10_000) : 0;
  const avgProfitPerTradeLamports =
    closedTrades > 0
      ? Number(realizedPnL) / closedTrades
      : 0;

  // Recent activity = joined trades, newest first
  const activity = await sql<
    {
      signature: string;
      market_pda: string;
      identifier: string;
      display_name: string | null;
      asset_class: number;
      side: number;
      sol_amount: bigint;
      token_amount: bigint;
      ratchet_bps: number;
      block_time: bigint;
      slot: bigint;
    }[]
  >`
    SELECT t.signature, t.market_pda, m.identifier, m.display_name, m.asset_class,
           t.side, t.sol_amount, t.token_amount, t.ratchet_bps, t.block_time, t.slot
    FROM trades t
    JOIN markets m ON m.pda = t.market_pda
    WHERE t.trader = ${address}
    ORDER BY t.block_time DESC
    LIMIT ${limit}
  `;

  return c.json(
    jsonSafe({
      address,
      positions: enrichedPositions,
      stats: {
        total_trades: totalTrades,
        buy_count: buyCount,
        sell_count: sellCount,
        closed_trades: closedTrades,
        win_rate_bps: winRateBps,
        total_volume_lamports: totalVolume,
        sol_spent_lamports: solSpent,
        sol_received_lamports: solReceived,
        realized_pnl_lamports: realizedPnL,
        unrealized_pnl_lamports: unrealizedPnL,
        total_held_value_lamports: totalHeldValue,
        avg_profit_per_trade_lamports: avgProfitPerTradeLamports,
      },
      activity,
    }),
  );
});

