import { PublicKey } from "@solana/web3.js";
import { parseTradeEvents, decodeMarket } from "../solana/decoder";
import { connection } from "../solana/connection";
import * as db from "../db";
import { log } from "../utils/log";

/**
 * Trade event sol_amount semantics differ between buy and sell:
 *   - Buy: ev.solAmount = sol_amount_in (gross). Pool gains sol_after_fee = gross - fee.
 *   - Sell: ev.solAmount = sol_to_seller (post-fee). Pool loses sol_before_fee = post / (1 - fee_bps/10000).
 * To avoid duplicating fee math in two places (and keeping it correct if the
 * factory fee changes), we re-decode the on-chain Market account after the
 * trade and trust that as the source of truth for reserves/minted.
 */
export async function indexTransaction(tx: {
  signature: string;
  slot: number;
  blockTime?: number;
  meta?: { logMessages?: string[] };
}) {
  const logs = tx.meta?.logMessages ?? [];
  const events = parseTradeEvents(logs);
  if (events.length === 0) return;

  for (const ev of events) {
    const market = await db.getMarketByPda(ev.market);
    if (!market) {
      log.debug({ market: ev.market }, "Trade for unknown market — skipping");
      continue;
    }

    await db.insertTrade({
      signature: tx.signature,
      market_pda: ev.market,
      side: ev.side,
      trader: ev.trader,
      sol_amount: ev.solAmount,
      token_amount: ev.tokenAmount,
      ratchet_bps: ev.ratchetBps,
      block_time: BigInt(tx.blockTime ?? Number(ev.timestamp)),
      slot: BigInt(tx.slot),
    });

    // Re-fetch on-chain Market state — authoritative, includes the post-trade
    // reserves/minted that the SC computed (with fee math already applied).
    try {
      const acc = await connection.getAccountInfo(new PublicKey(ev.market));
      if (acc) {
        const decoded = decodeMarket(acc.data);
        await db.syncMarketStateFromTrade({
          pda: ev.market,
          real_sol_reserves: decoded.realSolReserves,
          tokens_minted: decoded.tokensMinted,
          slot: BigInt(tx.slot),
        });
      }
    } catch (e) {
      log.warn(
        { err: e, market: ev.market, signature: tx.signature },
        "Failed to re-sync market state from chain after trade",
      );
    }

    log.info(
      { signature: tx.signature, market: ev.market, side: ev.side },
      "Trade indexed",
    );
  }
}
