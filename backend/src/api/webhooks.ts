import { Hono } from "hono";
import { createHash, createHmac, timingSafeEqual } from "crypto";
import { config } from "../config";
import * as db from "../db";
import { queue } from "../queue";
import { indexTransaction } from "../services/trade-indexer";
import { log } from "../utils/log";

export const webhookRoutes = new Hono();

/**
 * Inbound Elfa Auto webhook delivery — verified per official spec
 * (https://github.com/elfa-ai/elfa-ai-skill SKILL.md).
 *
 *   signing_key = SHA256(ELFA_AUTO_WEBHOOK_SECRET)
 *   expected    = HMAC-SHA256(signing_key, `${timestamp}.${eventId}.${rawBody}`) → hex
 *   header      = X-Auto-Signature: v1=<hex>
 *   timestamp   = X-Auto-Signature-Timestamp (unix seconds, drift cap 30s)
 *   eventId     = X-Auto-Event-Id (untuk dedup)
 *
 * NOTE: skema ini berbeda dengan signing OUTGOING request (auto-client.ts).
 * Outgoing request pakai secret langsung sebagai HMAC key dengan payload
 * `${ts}${METHOD}${mountedPath}${body}`. Inbound webhook double-hash secret-nya
 * dan pakai dotted-separator payload — jangan dicampur.
 */
function verifyAutoWebhook(
  rawBody: string,
  signatureHeader: string,
  timestamp: string,
  eventId: string,
): boolean {
  if (!signatureHeader.startsWith("v1=")) return false;
  const given = signatureHeader.slice(3);
  const signingKey = createHash("sha256")
    .update(config.ELFA_AUTO_WEBHOOK_SECRET)
    .digest();
  const payload = `${timestamp}.${eventId}.${rawBody}`;
  const expected = createHmac("sha256", signingKey).update(payload).digest("hex");
  if (given.length !== expected.length) return false;
  try {
    return timingSafeEqual(
      Buffer.from(given, "hex"),
      Buffer.from(expected, "hex"),
    );
  } catch {
    return false;
  }
}

webhookRoutes.post("/elfa", async (c) => {
  const sig = c.req.header("x-auto-signature");
  const ts = c.req.header("x-auto-signature-timestamp");
  const eventId = c.req.header("x-auto-event-id");
  if (!sig || !ts || !eventId)
    return c.json({ error: "Missing signature headers" }, 400);

  // Replay window: 30s drift cap (per Elfa docs)
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 30) {
    return c.json({ error: "Timestamp drift too large" }, 401);
  }

  const rawBody = await c.req.text();
  if (!verifyAutoWebhook(rawBody, sig, ts, eventId)) {
    return c.json({ error: "Invalid signature" }, 401);
  }

  if (await db.autoEventExists(eventId)) {
    return c.json({ ok: true, duplicate: true });
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }

  await db.insertAutoEvent({
    event_id: eventId,
    query_id: payload.queryId ?? "",
    channel: payload.channel ?? "webhook",
    payload,
    received_at: BigInt(Date.now()),
  });

  // Return 2xx fast; queue handles processing async (per Elfa best-practice)
  queue.push("auto_event", { eventId, payload });

  return c.json({ ok: true }, 202);
});

webhookRoutes.post("/helius", async (c) => {
  const auth = c.req.header("authorization");
  if (
    config.HELIUS_WEBHOOK_SECRET &&
    auth !== `Bearer ${config.HELIUS_WEBHOOK_SECRET}`
  ) {
    return c.text("Unauthorized", 401);
  }

  let txs: any[];
  try {
    txs = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }

  for (const tx of txs) {
    // Helius raw format: signature di tx.transaction.signatures[0]
    // Helius enhanced format: signature di tx.signature top-level
    const signature: string | undefined =
      tx.signature ?? tx.transaction?.signatures?.[0];
    if (!signature) {
      log.warn({ tx: JSON.stringify(tx).slice(0, 200) }, "Helius webhook: no signature found");
      continue;
    }
    try {
      await indexTransaction({
        signature,
        slot: tx.slot,
        blockTime: tx.blockTime,
        meta: { logMessages: tx.meta?.logMessages ?? tx.logMessages ?? [] },
      });
    } catch (e) {
      log.warn({ err: e, sig: signature }, "Helius index failed");
    }
  }

  return c.text("OK");
});
