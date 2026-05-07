import { parseTradeEvents } from "../solana/decoder";
import * as db from "../db";
import { log } from "../utils/log";

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

    const newReserves =
      ev.side === 0
        ? market.real_sol_reserves + ev.solAmount
        : market.real_sol_reserves - ev.solAmount;
    const newMinted =
      ev.side === 0
        ? market.tokens_minted + ev.tokenAmount
        : market.tokens_minted - ev.tokenAmount;

    await db.syncMarketStateFromTrade({
      pda: ev.market,
      real_sol_reserves: newReserves > 0n ? newReserves : 0n,
      tokens_minted: newMinted > 0n ? newMinted : 0n,
      slot: BigInt(tx.slot),
    });

    log.info(
      { signature: tx.signature, market: ev.market, side: ev.side },
      "Trade indexed",
    );
  }
}
