import { Hono } from "hono";
import { trendingPoller } from "../services/trending-poller";
import { oracleUpdater } from "../services/oracle-updater";
import { localHypeDetector } from "../services/local-hype-detector";
import { marketSpawner } from "../services/market-spawner";
import * as db from "../db";
import { log } from "../utils/log";

const jsonSafe = (v: unknown): unknown =>
  JSON.parse(
    JSON.stringify(v, (_, x) => (typeof x === "bigint" ? x.toString() : x)),
  );

export const adminRoutes = new Hono();

// Force-trigger Elfa trending poll (narratives + tokens + CAs).
// Useful untuk evidence auto-spawn working tanpa nunggu 15min cron.
adminRoutes.post("/poll-trending", async (c) => {
  const started = Date.now();
  try {
    await trendingPoller.pollAll();
    return c.json({
      ok: true,
      elapsedMs: Date.now() - started,
    });
  } catch (e: any) {
    log.error({ err: e }, "Manual poll-trending failed");
    return c.json({ ok: false, error: e.message }, 500);
  }
});

// Force-trigger oracle update for all markets.
adminRoutes.post("/update-oracles", async (c) => {
  const started = Date.now();
  try {
    await oracleUpdater.updateAll();
    return c.json({
      ok: true,
      elapsedMs: Date.now() - started,
    });
  } catch (e: any) {
    log.error({ err: e }, "Manual update-oracles failed");
    return c.json({ ok: false, error: e.message }, 500);
  }
});

// Force-trigger local hype detector — scan all trend markets for surges
// and boost peak mindshare on-chain when threshold crossed.
adminRoutes.post("/scan-hype", async (c) => {
  const started = Date.now();
  try {
    await localHypeDetector.scanAll();
    return c.json({
      ok: true,
      elapsedMs: Date.now() - started,
    });
  } catch (e: any) {
    log.error({ err: e }, "Manual scan-hype failed");
    return c.json({ ok: false, error: e.message }, 500);
  }
});

// Demo / dev utility: artificially force a hype event for a specific market.
// Useful when real surge detection won't fire (sparse Elfa data).
adminRoutes.post("/force-hype", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { identifier, bps } = body as { identifier?: string; bps?: number };
  if (!identifier) return c.json({ error: "identifier required" }, 400);
  try {
    const result = await localHypeDetector.forceFire(identifier, bps);
    return c.json(result);
  } catch (e: any) {
    log.error({ err: e, identifier }, "force-hype failed");
    return c.json({ error: e.message }, 500);
  }
});

// List recent AI-judged candidates. Filter via ?verdict=spawn|skip|merge|...
adminRoutes.get("/candidates", async (c) => {
  const verdict = c.req.query("verdict") as
    | db.MarketCandidateRow["verdict"]
    | undefined;
  const limit = Number(c.req.query("limit") ?? "100");
  const rows = await db.listMarketCandidates({ verdict, limit });
  return c.json({
    count: rows.length,
    candidates: rows.map((r) => ({
      ...r,
      id: r.id.toString(),
      created_at: r.created_at.toString(),
      decided_at: r.decided_at?.toString() ?? null,
    })),
  });
});

// Manual override: force-spawn a previously-skipped candidate. Useful when
// the AI was too conservative or you want to demo a specific narrative.
adminRoutes.post("/candidates/:id/approve", async (c) => {
  const raw = c.req.param("id");
  let id: bigint;
  try {
    id = BigInt(raw);
  } catch {
    return c.json({ error: "Invalid candidate id" }, 400);
  }
  const cand = await db.getMarketCandidate(id);
  if (!cand) return c.json({ error: "candidate not found" }, 404);
  if (!cand.ai_identifier || cand.ai_asset_class === null) {
    return c.json({ error: "candidate has no AI identifier or asset_class" }, 400);
  }

  const existing = await db.getMarketByIdentifier(cand.ai_identifier);
  if (existing) {
    await db.updateCandidateVerdict(id, "manual_approve", existing.pda);
    return c.json(jsonSafe({ ok: true, alreadyExists: true, market: existing }));
  }

  try {
    const market = await marketSpawner.ensureMarket({
      identifier: cand.ai_identifier,
      assetClass: cand.ai_asset_class,
      source: "auto_spawn",
      displayName: cand.ai_display_name ?? null,
    });
    await db.updateCandidateVerdict(id, "manual_approve", market.pda);
    return c.json(jsonSafe({ ok: true, market }));
  } catch (e: any) {
    log.error({ err: e, id: id.toString() }, "Manual approve spawn failed");
    return c.json({ ok: false, error: e.message }, 500);
  }
});

// Manual reject: mark a pending/skip candidate as permanently rejected
// (so dedup window keeps re-judging from being attempted).
adminRoutes.post("/candidates/:id/reject", async (c) => {
  const raw = c.req.param("id");
  let id: bigint;
  try {
    id = BigInt(raw);
  } catch {
    return c.json({ error: "Invalid candidate id" }, 400);
  }
  const cand = await db.getMarketCandidate(id);
  if (!cand) return c.json({ error: "candidate not found" }, 404);
  await db.updateCandidateVerdict(id, "manual_reject");
  return c.json({ ok: true });
});
