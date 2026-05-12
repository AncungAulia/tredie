import cron from "node-cron";
import * as elfa from "../elfa/client";
import * as db from "../db";
import { config } from "../config";
import { log } from "../utils/log";
import { marketSpawner } from "./market-spawner";
import { metadataEnricher } from "./metadata-enricher";
import { resolveTickerImage } from "./ticker-image-resolver";
import { judgeCandidates, JudgeCandidate, JudgeDecision } from "../ai/gemini-judge";

const DEDUP_WINDOW_MS = 60 * 60 * 1000; // re-judge same input only after 1h

function detectAssetClass(symbol: string): number {
  if (symbol.startsWith("xyz:")) {
    const base = symbol.slice(4);
    if (/^[A-Z]{6}$/.test(base)) return 4; // FX
    if (["XAU", "XAG", "CL", "NG", "HG", "ZW", "ZC"].includes(base)) return 3;
    return 2;
  }
  return 0;
}

interface CandidateSummary {
  sourceKind: "narrative" | "token" | "ca_twitter" | "ca_telegram";
  sourceKey: string;
  /** Stored verbatim in market_candidates.raw_input (audit trail). */
  rawInput: Record<string, unknown>;
  /** Compact payload sent to Gemini — keep below ~10 fields per candidate. */
  payloadForAI: Record<string, unknown>;
  /** Used when AI gating is disabled or the judge returns null. */
  fallback: {
    identifier: string;
    assetClass: number;
    displayName?: string | null;
    imageUrl?: string | null;
    sourceUrl?: string | null;
    sourceMetadata?: object | null;
    shouldSpawnByRule: boolean;
  };
}

/**
 * Sanity-check + normalize the AI-decided identifier before we use it as
 * an on-chain seed. Returns null if invalid.
 *
 * Convention (all asset classes capped at 10 bytes — MPL symbol limit):
 *   class 0/1 (crypto/dex):      "a" + UPPERCASE         e.g. aBTC, aETH, aPEPE
 *   class 2/3/4 (equity/cmd/fx): "ax" + UPPERCASE        e.g. axNVDA, axXAU, axDXY
 *   class 5 (Solana CA):         (currently unspawnable, base58 too long)
 *   class 6 (trend):             camelCase, no prefix    e.g. cnbadd, labubu
 *
 * The "a" / "ax" prefix marks an attention-token. The on-chain SC derives
 * the SPL symbol verbatim from this identifier, so wallets/explorers will
 * show e.g. "aBTC" — making it visually obvious this is the attention
 * version, not the underlying asset.
 */
const MPL_SYMBOL_CAP_BYTES = 10;

function validateIdentifier(
  identifier: string,
  assetClass: number,
): string | null {
  if (!identifier) return null;
  const trimmed = identifier.trim();
  if (Buffer.byteLength(trimmed, "utf8") > MPL_SYMBOL_CAP_BYTES) return null;

  switch (assetClass) {
    case 0:
    case 1:
      // a + uppercase ticker. Total 3-10 bytes (a + 2-9 char ticker).
      if (!/^a[A-Z0-9]{2,9}$/.test(trimmed)) return null;
      return trimmed;
    case 2:
    case 3:
    case 4:
      // ax + uppercase ticker. Total 4-10 bytes (ax + 2-8 char ticker).
      if (!/^ax[A-Z0-9]{2,8}$/.test(trimmed)) return null;
      return trimmed;
    case 5:
      // Solana CA: base58 32-44 chars. Exceeds MPL cap, blocked at collect
      // layer. This branch only runs if caller bypassed the pre-filter.
      if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(trimmed)) return null;
      return trimmed;
    case 6:
      // trend: camelCase, no prefix. Start lowercase letter, 2-10 chars.
      if (!/^[a-z][a-zA-Z0-9]{1,9}$/.test(trimmed)) return null;
      return trimmed;
    default:
      return null;
  }
}

declare global {
  // eslint-disable-next-line no-var
  var __tredieTrendingPollerRunning: boolean | undefined;
  // eslint-disable-next-line no-var
  var __tredieTrendingPollerCronRegistered: boolean | undefined;
}

export class TrendingPoller {
  start() {
    if (globalThis.__tredieTrendingPollerCronRegistered) {
      log.debug("TrendingPoller cron already registered (bun --hot reload)");
      return;
    }
    globalThis.__tredieTrendingPollerCronRegistered = true;

    this.pollAll().catch((e) => log.error({ err: e }, "Initial poll failed"));
    cron.schedule(config.TRENDING_POLL_CRON, () => {
      this.pollAll().catch((e) =>
        log.error({ err: e }, "Scheduled poll failed"),
      );
    });
    log.info({ schedule: config.TRENDING_POLL_CRON }, "TrendingPoller started");
  }

  async pollAll() {
    if (globalThis.__tredieTrendingPollerRunning) {
      log.debug("pollAll skipped — previous run still in progress");
      return;
    }
    globalThis.__tredieTrendingPollerRunning = true;
    try {
      return await this.pollAllInner();
    } finally {
      globalThis.__tredieTrendingPollerRunning = false;
    }
  }

  private async pollAllInner() {
    const results = await Promise.allSettled([
      this.collectNarratives(),
      this.collectTokens(),
      this.collectCAs("twitter"),
      this.collectCAs("telegram"),
    ]);
    const candidates = results.flatMap((r) =>
      r.status === "fulfilled" ? r.value : [],
    );

    if (candidates.length === 0) {
      log.info("No spawn candidates this cycle");
      return;
    }

    // Deduplicate: skip candidates already judged within the dedup window
    // (avoids re-spending Gemini quota on the same trend every 15 min).
    const fresh: CandidateSummary[] = [];
    for (const c of candidates) {
      const recent = await db.getRecentCandidateDecision(
        c.sourceKind,
        c.sourceKey,
        DEDUP_WINDOW_MS,
      );
      if (!recent) fresh.push(c);
    }

    log.info(
      { total: candidates.length, fresh: fresh.length },
      "Candidates collected",
    );

    if (fresh.length === 0) return;

    if (config.AI_GATING_ENABLED && config.GEMINI_API_KEY) {
      await this.aiGate(fresh);
    } else {
      await this.legacySpawn(fresh);
    }
  }

  // ── Collectors ─────────────────────────────────────────────────────────

  async collectNarratives(): Promise<CandidateSummary[]> {
    const res = await elfa.getTrendingNarratives("day", 10);
    return res.narratives.map((item) => ({
      sourceKind: "narrative" as const,
      sourceKey: item.narrative.slice(0, 200),
      rawInput: item as unknown as Record<string, unknown>,
      payloadForAI: {
        narrative: item.narrative,
        tweet_count: item.tweet_ids?.length ?? 0,
      },
      fallback: {
        identifier: elfa.normalizeTrendId(item.narrative) ?? "",
        assetClass: 6,
        displayName: item.narrative,
        sourceUrl: item.source_links?.[0] ?? null,
        sourceMetadata: { tweetIds: item.tweet_ids?.slice(0, 5) },
        shouldSpawnByRule: !!elfa.normalizeTrendId(item.narrative),
      },
    }));
  }

  async collectTokens(): Promise<CandidateSummary[]> {
    const tokens = await elfa.getTrendingTokens("1h", 50);

    // Pre-compute asset classes and base tickers so we can resolve images in parallel
    const tokenMeta = tokens.map((token) => {
      const sym = token.token.toUpperCase();
      const cls = detectAssetClass(sym);
      const baseTicker = sym.startsWith("xyz:") ? sym.slice(4) : sym;
      return { sym, cls, baseTicker };
    });

    // Resolve logo URLs in parallel — failures return null (letter-avatar fallback)
    const imageResults = await Promise.allSettled(
      tokenMeta.map(({ baseTicker, cls }) => resolveTickerImage(baseTicker, cls)),
    );

    const out: CandidateSummary[] = [];
    for (const [idx, token] of tokens.entries()) {
      const { sym, cls, baseTicker } = tokenMeta[idx];
      const mindshareBps = elfa.tokenMindshareBps(token, tokens);
      const mindsharePct = mindshareBps / 100;

      await db.upsertTrendingToken({
        symbol: sym,
        mention_count: token.current_count,
        mindshare_pct: mindsharePct,
        rank_position: idx + 1,
        fetched_at: BigInt(Date.now()),
      });

      // Build attention-token identifier per new convention:
      //   crypto/dex (asset_class 0/1) → "a" + UPPERCASE ticker
      //   equity/commodity/fx (2/3/4)  → "ax" + UPPERCASE ticker (Elfa
      //     prefixes them with "xyz:" already; strip and re-prefix)
      const attnIdentifier =
        cls === 0 || cls === 1 ? `a${baseTicker}` : `ax${baseTicker}`;
      // Validate length cap; if ticker too long, fallback identifier becomes
      // empty so legacy-spawn skips it (AI path can shorten more aggressively).
      const fallbackIdentifier =
        Buffer.byteLength(attnIdentifier, "utf8") <= 10 ? attnIdentifier : "";

      const imageUrl =
        imageResults[idx].status === "fulfilled"
          ? imageResults[idx].value
          : null;

      out.push({
        sourceKind: "token" as const,
        sourceKey: sym,
        rawInput: token as unknown as Record<string, unknown>,
        payloadForAI: {
          symbol: sym,
          mention_count: token.current_count,
          previous_count: token.previous_count,
          change_percent: token.change_percent,
          rank: idx + 1,
        },
        fallback: {
          identifier: fallbackIdentifier,
          assetClass: cls,
          displayName: baseTicker,
          imageUrl,
          shouldSpawnByRule:
            !!fallbackIdentifier &&
            mindsharePct > config.AUTO_SPAWN_THRESHOLD_PCT,
        },
      });
    }
    log.debug({ count: tokens.length }, "Trending tokens collected");
    return out;
  }

  async collectCAs(
    platform: "twitter" | "telegram",
  ): Promise<CandidateSummary[]> {
    const cas =
      platform === "twitter"
        ? await elfa.getTrendingCAsTwitter("1h")
        : await elfa.getTrendingCAsTelegram("1h");
    const out: CandidateSummary[] = [];

    for (const [idx, ca] of cas.entries()) {
      await db.upsertTrendingCA({
        contract_address: ca.contractAddress,
        source_platform: platform,
        mention_count: ca.mentionCount,
        rank_position: idx + 1,
        fetched_at: BigInt(Date.now()),
      });

      const isSolana = ca.chain === "solana";
      if (isSolana) metadataEnricher.fetch(ca.contractAddress).catch(() => {});

      // Only Solana CAs are spawnable on-chain.
      if (!isSolana) continue;

      // On-chain identifier seed is capped at 32 UTF-8 bytes — Solana CAs
      // are 32–44 chars so we filter long ones upfront to save Gemini quota
      // (validateIdentifier would reject them anyway).
      if (Buffer.byteLength(ca.contractAddress, "utf8") > 32) continue;

      const meta = await db.getTokenMetadata(ca.contractAddress);
      out.push({
        sourceKind: platform === "twitter" ? "ca_twitter" : "ca_telegram",
        sourceKey: ca.contractAddress,
        rawInput: ca as unknown as Record<string, unknown>,
        payloadForAI: {
          contract_address: ca.contractAddress,
          chain: ca.chain,
          mention_count: ca.mentionCount,
          platform,
          symbol: meta?.symbol ?? null,
          name: meta?.name ?? null,
        },
        fallback: {
          identifier: ca.contractAddress,
          assetClass: 5,
          displayName: meta?.symbol ?? meta?.name ?? null,
          imageUrl: meta?.image_url ?? null,
          shouldSpawnByRule: ca.mentionCount > config.CA_SPAWN_THRESHOLD,
        },
      });
    }
    log.debug({ platform, count: cas.length }, "Trending CAs collected");
    return out;
  }

  // ── AI gating path ─────────────────────────────────────────────────────

  private async aiGate(candidates: CandidateSummary[]) {
    const judgeInputs: JudgeCandidate[] = candidates.map((c) => ({
      kind: c.sourceKind === "ca_twitter" || c.sourceKind === "ca_telegram"
        ? c.sourceKind
        : (c.sourceKind as JudgeCandidate["kind"]),
      payload: c.payloadForAI,
    }));

    const result = await judgeCandidates(judgeInputs);

    if (!result.ok) {
      // For rate limit / transient API issues, do NOT fallback to legacy:
      // legacy rule-based path is permissive and would spam-spawn everything
      // above a threshold, defeating the AI gating purpose. Just defer to
      // next cycle; dedup window keeps these candidates fresh.
      if (
        result.reason === "rate_limited" ||
        result.reason === "http_error" ||
        result.reason === "fetch_failed" ||
        result.reason === "invalid_json"
      ) {
        log.warn(
          { reason: result.reason, candidates: candidates.length },
          "Gemini gate failed — skipping cycle, will retry on next poll",
        );
        return;
      }
      // reason === "no_key" means AI gating intentionally disabled — use
      // the rule-based legacy path as a graceful degradation.
      log.info("AI gating disabled (no GEMINI_API_KEY) — using legacy spawn");
      await this.legacySpawn(candidates);
      return;
    }
    const decisions = result.decisions;

    // Index decisions by candidate index for O(1) lookup.
    const byIndex = new Map<number, JudgeDecision>();
    for (const d of decisions) byIndex.set(d.index, d);

    let spawned = 0;
    let skipped = 0;
    let merged = 0;
    let lowConfidence = 0;
    let invalidIdent = 0;

    // Track display names spawned within this batch to catch within-cycle
    // duplicates where Gemini assigns different identifiers to the same topic.
    const spawnedDisplayNames = new Set<string>();

    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i];
      const d = byIndex.get(i);

      if (!d) {
        // Decision missing — log as pending so we'll retry next cycle.
        await db.insertMarketCandidate({
          source_kind: c.sourceKind,
          source_key: c.sourceKey,
          raw_input: c.rawInput,
          verdict: "pending",
        });
        continue;
      }

      const baseRow = {
        source_kind: c.sourceKind,
        source_key: c.sourceKey,
        raw_input: c.rawInput,
        ai_identifier: d.identifier,
        ai_display_name: d.display_name,
        ai_asset_class: d.asset_class,
        ai_confidence_bps: d.confidence_bps,
        ai_reason: d.reason,
        ai_model: config.GEMINI_MODEL,
      };

      if (d.verdict === "skip") {
        skipped++;
        await db.insertMarketCandidate({ ...baseRow, verdict: "skip" });
        continue;
      }

      if (d.verdict === "merge") {
        merged++;
        const mergedWith =
          typeof d.merged_with_index === "number"
            ? candidates[d.merged_with_index]?.sourceKey ?? null
            : null;
        await db.insertMarketCandidate({
          ...baseRow,
          verdict: "merge",
          merged_with: mergedWith,
        });
        continue;
      }

      // verdict === "spawn"
      if (d.confidence_bps < config.AI_MIN_CONFIDENCE_BPS) {
        lowConfidence++;
        await db.insertMarketCandidate({
          ...baseRow,
          verdict: "skip",
          ai_reason: `low_confidence: ${d.reason}`,
        });
        continue;
      }

      const validIdent = validateIdentifier(d.identifier, d.asset_class);
      if (!validIdent) {
        invalidIdent++;
        log.warn(
          { ident: d.identifier, assetClass: d.asset_class, sourceKey: c.sourceKey },
          "AI returned invalid identifier — skipping",
        );
        await db.insertMarketCandidate({
          ...baseRow,
          verdict: "skip",
          ai_reason: `invalid_identifier: ${d.reason}`,
        });
        continue;
      }

      // Skip if a market with this identifier already exists.
      const existing = await db.getMarketByIdentifier(validIdent);
      if (existing) {
        await db.insertMarketCandidate({
          ...baseRow,
          verdict: "merge",
          merged_with: validIdent,
          spawn_market_pda: existing.pda,
        });
        merged++;
        continue;
      }

      // Dedup by display_name: catch cases where Gemini assigns different
      // identifiers to semantically identical topics across cycles or within
      // the same batch (e.g. "Coinbase Outage" → cbOutage vs coinOutage).
      const resolvedDisplayName = d.display_name ?? c.fallback.displayName;
      if (resolvedDisplayName) {
        const normalizedName = resolvedDisplayName.toLowerCase().trim();

        // Within-batch check
        if (spawnedDisplayNames.has(normalizedName)) {
          await db.insertMarketCandidate({
            ...baseRow,
            verdict: "merge",
            ai_reason: `display_name_dedup (within-batch): ${resolvedDisplayName}`,
          });
          merged++;
          continue;
        }

        // DB check for previously spawned markets with the same display_name
        const nameDuplicate = await db.findMarketByDisplayName(resolvedDisplayName);
        if (nameDuplicate) {
          await db.insertMarketCandidate({
            ...baseRow,
            verdict: "merge",
            merged_with: nameDuplicate.identifier,
            spawn_market_pda: nameDuplicate.pda,
            ai_reason: `display_name_dedup (db): ${resolvedDisplayName}`,
          });
          merged++;
          continue;
        }
      }

      const candidateId = await db.insertMarketCandidate({
        ...baseRow,
        verdict: "spawn",
        ai_identifier: validIdent,
      });

      try {
        const market = await marketSpawner.ensureMarket({
          identifier: validIdent,
          assetClass: d.asset_class,
          source: "auto_spawn",
          displayName: resolvedDisplayName ?? null,
          imageUrl: c.fallback.imageUrl ?? null,
          sourceUrl: c.fallback.sourceUrl ?? null,
          sourceMetadata: c.fallback.sourceMetadata ?? null,
        });
        await db.updateCandidateVerdict(candidateId, "spawn", market.pda);
        if (resolvedDisplayName) {
          spawnedDisplayNames.add(resolvedDisplayName.toLowerCase().trim());
        }
        spawned++;
      } catch (e: any) {
        await db.updateCandidateVerdict(candidateId, "spawn_failed");
        log.warn(
          { err: e?.message, ident: validIdent },
          "AI-approved spawn failed",
        );
      }
    }

    log.info(
      { spawned, skipped, merged, lowConfidence, invalidIdent },
      "AI gating cycle complete",
    );
  }

  // ── Legacy rule-based path (fallback when Gemini disabled or down) ─────

  private async legacySpawn(candidates: CandidateSummary[]) {
    let spawned = 0;
    for (const c of candidates) {
      if (!c.fallback.shouldSpawnByRule || !c.fallback.identifier) {
        await db.insertMarketCandidate({
          source_kind: c.sourceKind,
          source_key: c.sourceKey,
          raw_input: c.rawInput,
          verdict: "skip",
          ai_reason: "below_threshold (legacy path)",
        });
        continue;
      }

      const existing = await db.getMarketByIdentifier(c.fallback.identifier);
      if (existing) continue;

      const candidateId = await db.insertMarketCandidate({
        source_kind: c.sourceKind,
        source_key: c.sourceKey,
        raw_input: c.rawInput,
        verdict: "spawn",
        ai_identifier: c.fallback.identifier,
        ai_display_name: c.fallback.displayName ?? null,
        ai_asset_class: c.fallback.assetClass,
        ai_reason: "rule_based (legacy path)",
      });

      try {
        const market = await marketSpawner.ensureMarket({
          identifier: c.fallback.identifier,
          assetClass: c.fallback.assetClass,
          source: "auto_spawn",
          displayName: c.fallback.displayName ?? null,
          imageUrl: c.fallback.imageUrl ?? null,
          sourceUrl: c.fallback.sourceUrl ?? null,
          sourceMetadata: c.fallback.sourceMetadata ?? null,
        });
        await db.updateCandidateVerdict(candidateId, "spawn", market.pda);
        spawned++;
      } catch (e: any) {
        await db.updateCandidateVerdict(candidateId, "spawn_failed");
        log.warn(
          { err: e?.message, ident: c.fallback.identifier },
          "Legacy spawn failed",
        );
      }
    }
    log.info({ spawned, total: candidates.length }, "Legacy spawn cycle complete");
  }
}

export const trendingPoller = new TrendingPoller();
