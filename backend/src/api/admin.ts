import { Hono } from "hono";
import { trendingPoller } from "../services/trending-poller";
import { oracleUpdater } from "../services/oracle-updater";
import { localHypeDetector } from "../services/local-hype-detector";
import { log } from "../utils/log";

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
