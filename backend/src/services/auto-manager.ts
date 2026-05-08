import cron from "node-cron";
import * as db from "../db";
import * as autoClient from "../elfa/auto-client";
import * as elfaClient from "../elfa/client";
import { config } from "../config";
import { log } from "../utils/log";

/**
 * Build EQL conditions block per asset class.
 *
 * - Tradeable assets (crypto/dex/equity/commodity/fx, classes 0-4) pakai TA + price
 *   karena mereka punya price data; backed off ke LLM kalau gak match.
 * - CA (5) skip langsung kalau identifier panjang — Auto symbol cap.
 * - Trend (6) gak punya price chart, jadi conditions LLM-only:
 *     "Has the keyword X had a viral mention spike in the last 1h?"
 */
/**
 * Recover the bare ticker from an attention-token identifier so Elfa Auto's
 * TA/price modules (which only know real tickers like BTC / NVDA) can look
 * it up. Mirror of stripAttentionPrefix in oracle-updater.
 */
function stripAttentionPrefix(identifier: string, assetClass: number): string {
  if (assetClass < 2 && identifier.startsWith("a") && identifier.length > 1) {
    return identifier.slice(1);
  }
  if (assetClass >= 2 && assetClass <= 4 && identifier.startsWith("ax")) {
    return identifier.slice(2);
  }
  return identifier;
}

function buildConditions(market: db.MarketRow): object | null {
  if (market.asset_class === 6) {
    // Prefer display_name (full readable phrase) over the camelCase slug
    // for keyword search — Elfa LLM works better with natural language.
    const keyword =
      market.display_name ??
      elfaClient.trendIdToKeyword(market.identifier) ??
      market.identifier;
    if (!keyword) return null;
    return {
      AND: [
        {
          source: "llm",
          method: "athena_condition",
          args: {
            query:
              `Has the topic or trend "${keyword}" had a sudden viral mention spike, ` +
              `meme amplification, or attention surge across X/Twitter in the last 1h?`,
            period: "1h",
            speed: "fast",
          },
          operator: "==",
          value: true,
        },
      ],
    };
  }

  // Tradeable assets: strip attention prefix so Elfa TA/price modules can
  // resolve the symbol. Elfa knows "BTC" / "NVDA", not our "aBTC" / "axNVDA".
  const baseTicker = stripAttentionPrefix(market.identifier, market.asset_class);
  // Use display_name in the LLM query for richer context when available.
  const llmLabel = market.display_name ?? baseTicker;

  return {
    OR: [
      {
        AND: [
          {
            source: "ta",
            method: "rsi",
            args: { symbol: baseTicker, timeframe: "1h", period: 14 },
            operator: "crosses_above",
            value: 70,
          },
          {
            source: "price",
            method: "change",
            args: { symbol: baseTicker, period: "1h" },
            operator: ">",
            value: 0.05,
          },
        ],
      },
      {
        source: "llm",
        method: "athena_condition",
        args: {
          query: `Has ${llmLabel} (${baseTicker}) had a viral mention or smart-account buy call in the last 1h?`,
          period: "1h",
          speed: "fast",
        },
        operator: "==",
        value: true,
      },
    ],
  };
}

export async function createHypeWatcher(market: db.MarketRow): Promise<string | null> {
  // Elfa Auto requires HTTPS webhook URL. In local dev BACKEND_URL=http://localhost,
  // so Auto subscription will fail with EQL_INVALID_ACTION. local-hype-detector
  // handles surge detection in dev — skip Auto subscription silently here.
  if (!config.BACKEND_URL.startsWith("https://")) {
    log.debug(
      { identifier: market.identifier, backendUrl: config.BACKEND_URL },
      "BACKEND_URL not HTTPS — skipping Elfa Auto subscription (local-hype-detector handles surges in dev)",
    );
    return null;
  }

  // Skip CA with overly long identifier (Auto symbol length cap)
  if (market.asset_class === 5 && market.identifier.length > 20) {
    log.debug({ identifier: market.identifier }, "Skipping Auto query for long CA");
    return null;
  }

  const conditions = buildConditions(market);
  if (!conditions) {
    log.debug({ identifier: market.identifier }, "No watcher conditions for market");
    return null;
  }

  const displayLabel =
    market.asset_class === 6
      ? (elfaClient.trendIdToKeyword(market.identifier) ?? market.identifier)
      : market.identifier;

  const request = {
    title: `Tredie hype: ${displayLabel}`,
    description:
      `Watcher for ${displayLabel} on Tredie. Triggers boost peak mindshare ` +
      `on-chain when the market shows a momentum or social-attention surge.`,
    query: {
      conditions,
      actions: [
        {
          stepId: "step_1",
          type: "webhook",
          params: {
            url: `${config.BACKEND_URL}/api/webhooks/elfa?market=${market.pda}&type=hype_event`,
          },
        },
      ],
      expiresIn: "7d",
    },
  };

  try {
    const v = await autoClient.validateQuery(request);
    if (!v.valid) {
      const reason = `validation: ${
        (v.errors ?? [])
          .map((e: any) => (typeof e === "string" ? e : JSON.stringify(e)))
          .join("; ") || "unknown"
      }`;
      log.warn(
        { errors: v.errors, identifier: market.identifier },
        "Auto query invalid",
      );
      await db.insertFailedAutoQuery({
        market_pda: market.pda,
        query_type: "hype_event",
        config: request,
        error_reason: reason,
      }).catch(() => {});
      return null;
    }
    const created = await autoClient.createQuery(request);
    await db.insertAutoQuery({
      query_id: created.queryId,
      query_type: "hype_event",
      market_pda: market.pda,
      config: request,
      status: "active",
      created_at: BigInt(Date.now()),
      expires_at: BigInt(Date.now() + 7 * 86_400_000),
    });
    log.info(
      { queryId: created.queryId, identifier: market.identifier },
      "Auto watcher created",
    );
    return created.queryId;
  } catch (e: any) {
    const reason = e?.message ?? String(e);
    log.warn({ err: reason, identifier: market.identifier }, "Auto watcher failed");
    await db.insertFailedAutoQuery({
      market_pda: market.pda,
      query_type: "hype_event",
      config: request,
      error_reason: `exception: ${reason}`,
    }).catch(() => {});
    return null;
  }
}

export function startRotationCron() {
  cron.schedule("0 2 * * *", async () => {
    const expiring = await db.getAutoQueriesExpiringSoon(24 * 60 * 60 * 1000);
    for (const q of expiring) {
      try {
        await autoClient.cancelQuery(q.query_id);
        if (q.market_pda) {
          const market = await db.getMarketByPda(q.market_pda);
          if (market) await createHypeWatcher(market);
        }
      } catch (e) {
        log.warn({ err: e, queryId: q.query_id }, "Rotation failed");
      }
    }
  });
}
