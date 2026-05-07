/**
 * Webhook simulator — kirim synthetic payload ke localhost untuk test trade-indexer
 * dan Elfa Auto event handler tanpa nunggu real delivery dari Helius / Elfa.
 *
 * Usage:
 *   bun run simulate:webhook -- helius BTC buy 0.5
 *   bun run simulate:webhook -- elfa <market_pda>
 */

import { createHash, createHmac } from "crypto";
import { PublicKey } from "@solana/web3.js";
import { config } from "../config";
import { marketPda } from "../solana/pda";
import * as db from "../db";

const TRADE_EVENT_DISC = createHash("sha256")
  .update("event:Trade")
  .digest()
  .subarray(0, 8);

function craftTradeEventLog(opts: {
  marketPda: string;
  side: 0 | 1;
  solAmount: bigint;
  tokenAmount: bigint;
  ratchetBps: number;
  trader: string;
  timestamp: bigint;
}): string {
  const buf = Buffer.alloc(8 + 32 + 1 + 8 + 8 + 4 + 32 + 8);
  let off = 0;
  TRADE_EVENT_DISC.copy(buf, off); off += 8;
  new PublicKey(opts.marketPda).toBuffer().copy(buf, off); off += 32;
  buf.writeUInt8(opts.side, off); off += 1;
  buf.writeBigUInt64LE(opts.solAmount, off); off += 8;
  buf.writeBigUInt64LE(opts.tokenAmount, off); off += 8;
  buf.writeUInt32LE(opts.ratchetBps, off); off += 4;
  new PublicKey(opts.trader).toBuffer().copy(buf, off); off += 32;
  buf.writeBigInt64LE(opts.timestamp, off);
  return `Program data: ${buf.toString("base64")}`;
}

async function simulateHelius(
  identifier: string,
  side: "buy" | "sell",
  solAmount: number,
) {
  const market = await db.getMarketByIdentifier(identifier);
  if (!market) throw new Error(`Market "${identifier}" not in DB`);

  const sideU8 = side === "buy" ? 0 : 1;
  const solLamports = BigInt(Math.floor(solAmount * 1e9));
  // Synthetic constant-product fill at current pool state
  const baseSol = market.base_virtual_sol + market.real_sol_reserves;
  const poolTokens = market.virtual_token_supply - market.tokens_minted;
  const k = baseSol * poolTokens;
  const newPoolSol = baseSol + solLamports;
  const newPoolTokens = k / newPoolSol;
  const tokensOut =
    sideU8 === 0 ? poolTokens - newPoolTokens : poolTokens - newPoolTokens; // simplified

  const fakeSig = "sim_" + Date.now() + "_" + Math.random().toString(36).slice(2, 10);
  const fakeTrader = "8CB7FRH1sT8NXfqDqKovfvCjEBMVciYNZLRE8Gei583z";
  const blockTime = Math.floor(Date.now() / 1000);
  const slot = 460_000_000 + Math.floor(Math.random() * 1000);

  const tradeLog = craftTradeEventLog({
    marketPda: market.pda,
    side: sideU8 as 0 | 1,
    solAmount: solLamports,
    tokenAmount: tokensOut > 0n ? tokensOut : 1000n,
    ratchetBps: market.ratchet_multiplier_bps,
    trader: fakeTrader,
    timestamp: BigInt(blockTime),
  });

  const payload = [
    {
      signature: fakeSig,
      slot,
      blockTime,
      meta: {
        logMessages: [
          `Program ${config.TREDIE_PROGRAM_ID} invoke [1]`,
          "Program log: Instruction: Buy",
          tradeLog,
          `Program ${config.TREDIE_PROGRAM_ID} consumed 50000 of 200000 compute units`,
          `Program ${config.TREDIE_PROGRAM_ID} success`,
        ],
      },
    },
  ];

  const url = `${config.BACKEND_URL}/api/webhooks/helius`;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (config.HELIUS_WEBHOOK_SECRET) {
    headers["Authorization"] = `Bearer ${config.HELIUS_WEBHOOK_SECRET}`;
  }

  console.log(`POST ${url}`);
  console.log(`  market: ${market.identifier} (${market.pda})`);
  console.log(`  side:   ${side}`);
  console.log(`  sol:    ${solAmount} SOL (${solLamports} lamports)`);
  console.log(`  tokens: ${tokensOut} (synthetic AMM fill)`);
  console.log(`  sig:    ${fakeSig}`);

  const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(payload) });
  const body = await res.text();
  console.log(`\n  → status: ${res.status}`);
  console.log(`  → body:   ${body}`);

  if (res.ok) {
    // Verify trade landed in DB
    const trades = await db.getRecentTrades(market.pda, 5);
    console.log(`\n  trades in DB for this market: ${trades.length}`);
    if (trades[0]?.signature === fakeSig) {
      console.log(`  ✓ trade indexed successfully`);
    }
  }
}

async function simulateElfa(marketPda: string) {
  // Find market for context
  const market = await db.getMarketByPda(marketPda);
  if (!market) throw new Error(`Market PDA "${marketPda}" not found`);

  const eventId = "evt_sim_" + Date.now();
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const payload = {
    queryId: "q_simulated",
    eventType: "query.triggered",
    eventId,
    timestamp: new Date().toISOString(),
    trigger: { symbol: market.identifier, reason: "simulated hype event" },
  };
  const rawBody = JSON.stringify(payload);

  // Per official Elfa skill: signing_key = SHA256(secret), payload = ts.eventId.body
  const signingKey = createHash("sha256")
    .update(config.ELFA_AUTO_WEBHOOK_SECRET || "test-secret")
    .digest();
  const sig = createHmac("sha256", signingKey)
    .update(`${timestamp}.${eventId}.${rawBody}`)
    .digest("hex");

  const url = `${config.BACKEND_URL}/api/webhooks/elfa`;
  console.log(`POST ${url}`);
  console.log(`  eventId:   ${eventId}`);
  console.log(`  market:    ${market.identifier}`);
  console.log(`  signature: v1=${sig.slice(0, 20)}...`);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-auto-signature": `v1=${sig}`,
      "x-auto-signature-timestamp": timestamp,
      "x-auto-event-id": eventId,
    },
    body: rawBody,
  });
  const body = await res.text();
  console.log(`\n  → status: ${res.status}`);
  console.log(`  → body:   ${body}`);
}

const [kind, ...rest] = process.argv.slice(2);
if (!kind) {
  console.error(
    "Usage:\n  bun run simulate:webhook -- helius <identifier> <buy|sell> <solAmount>\n  bun run simulate:webhook -- elfa <market_pda>",
  );
  process.exit(1);
}

(async () => {
  if (kind === "helius") {
    const [identifier, side, solStr] = rest;
    if (!identifier || !["buy", "sell"].includes(side ?? "") || !solStr) {
      console.error("usage: helius <identifier> <buy|sell> <solAmount>");
      process.exit(1);
    }
    await simulateHelius(identifier, side as "buy" | "sell", Number(solStr));
  } else if (kind === "elfa") {
    const [marketPda] = rest;
    if (!marketPda) {
      console.error("usage: elfa <market_pda>");
      process.exit(1);
    }
    await simulateElfa(marketPda);
  } else {
    console.error(`unknown kind: ${kind}`);
    process.exit(1);
  }
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
