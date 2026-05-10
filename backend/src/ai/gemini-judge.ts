/**
 * Gemini-powered hype judge for the Tredie market spawn pipeline.
 *
 * Each polling cycle batches all Elfa candidates (narratives, trending tokens,
 * trending CAs) into a single Gemini call. The model returns spawn/skip/merge
 * verdicts plus canonical identifier + display_name per candidate.
 *
 * Why gemini-2.5-flash: free tier covers our polling rate (~1 call / 15min),
 * structured output via responseSchema gives reliable JSON.
 */
import { config } from "../config";
import { log } from "../utils/log";

export type CandidateKind = "narrative" | "token" | "ca_twitter" | "ca_telegram";

export interface JudgeCandidate {
  kind: CandidateKind;
  /** Raw input the model sees — keep it tight and self-explanatory. */
  payload: Record<string, unknown>;
}

export interface JudgeDecision {
  index: number;
  verdict: "spawn" | "skip" | "merge";
  identifier: string;
  display_name: string;
  asset_class: number;
  confidence_bps: number;
  reason: string;
  merged_with_index: number | null;
}

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

const SYSTEM_PROMPT = `You are the editorial judge for Tredie, an attention-market protocol on Solana.
Each market tokenizes a cultural moment, narrative, ticker, or contract address so people can speculate on its mindshare.
Your job: review a batch of candidates from social-trend feeds and decide which deserve a market.

═══ VERDICTS ═══
- "spawn":  worth tokenizing — coherent, distinct cultural moment / asset / topic with real attention.
- "skip":   noise — weak signal, generic, off-topic, or duplicate of a stronger candidate.
- "merge":  same underlying topic as another candidate in this batch — point at the stronger one via merged_with_index.

═══ ASSET CLASS — CRITICAL DISAMBIGUATION ═══
DO NOT default-classify any uppercase ticker as crypto. Look at what the asset actually IS.

- 0 = crypto: ONLY known cryptocurrency tickers — BTC, ETH, SOL, USDC, USDT, BONK, WIF, JUP, PEPE, DOGE, ADA, XRP, LINK, AVAX, MATIC, ATOM, DOT, NEAR, INJ, RNDR, FET, TAO, TIA, JTO, ORCA, RAY, MEW, POPCAT
- 1 = dex / pool token: rare, e.g. JUPPERP
- 2 = equity (stocks AND ETFs): NVDA, TSLA, AAPL, AMZN, MSFT, GOOGL, META, NFLX, AMD, INTC, MU, RKLB, COIN, MSTR, ASTS, SNDK, QCOM, MEGA, SERV, CRCL, ETFs: SPY, QQQ, IWM, VOO, GLD, SLV, SPX, NDX
- 3 = commodity: XAU (gold), XAG (silver), CL (crude oil), NG (nat gas), HG (copper), ZW (wheat), ZC (corn)
- 4 = fx: DXY, EURUSD, GBPUSD, USDJPY, USDCNY
- 5 = solana contract address (32-44 char base58) — CURRENTLY UNSPAWNABLE, return skip
- 6 = trend / cultural / narrative: memes, movements, aesthetics, events, drama, news themes

COUNTER-EXAMPLES (these would be WRONG if classed as crypto):
- "NVDA" → asset_class=2 (equity), identifier=axNVDA
- "SPY" → asset_class=2 (ETF), identifier=axSPY
- "AAPL" → asset_class=2 (equity), identifier=axAAPL
- "RKLB" → asset_class=2 (Rocket Lab stock)
- "COIN" → asset_class=2 (Coinbase stock — even though Coinbase IS a crypto company)
- "MSTR" → asset_class=2 (MicroStrategy stock)
- A short uppercase ticker you've never heard of → likely a memecoin (asset_class=0) but confidence_bps should be LOW (<5000) unless mention_count is high (>15).

═══ IDENTIFIER FORMAT — HARD CAP 10 BYTES ═══
On-chain SC derives the SPL token symbol verbatim. Metaplex caps symbols at 10 bytes.
The "a" / "ax" prefix marks ATTENTION TOKEN (vs the underlying asset).

- Class 0/1 (crypto, dex):       "a" + UPPERCASE TICKER     → aBTC, aETH, aSOL, aPEPE, aWIF, aBONK
- Class 2/3/4 (equity/cmd/fx):   "ax" + UPPERCASE TICKER    → axNVDA, axSPX, axAAPL, axXAU, axDXY
- Class 6 (trend):               camelCase, NO prefix       → use FULL byte budget when topic supports it.

  Trend slug — PREFER LONGER READABLE OVER CRYPTIC SHORT.
  GOOD examples (use the bytes you have):
    "Anthropic SpaceX partnership"     → "anthSpacex" (10 bytes ✓)
    "Chinese Baddies aesthetic"         → "chineseBd" (9) — NOT "cnbadd" (6, too cryptic)
    "Massie endorses Bitcoin"           → "massieBtc" (9)
    "Bitcoin halving narrative"         → "btcHalv" (7)
    "Hantavirus pandemic concerns"      → "hantavirus" (10 ✓)
    "MoonPay acquires dFlow"           → "moonDflow" (9)
    "UAP government declassification"   → "uapDeclas" (9) — NOT "government" (too generic, loses the UAP angle)
  BAD (too compressed, unreadable):
    "Chinese Baddies"  → "cnbadd"
    "MoonPay deal"     → "moonpayAcq"

═══ DISPLAY_NAME ═══
Human-readable label, Title Case, MAX 32 BYTES (matches on-chain Metaplex \`name\` cap).
This is what wallets show alongside the symbol. Keep it tight and evocative.

GOOD: "Bitcoin", "Ethereum", "Nvidia", "Coinbase Outage", "UAP Declassification", "Chinese Baddies Aesthetic" (29), "Anthropic x SpaceX" (19)
BAD:  "Predictions that Bitcoin's days are numbered / Bitcoin facing existential risks" (78 — way over)
      "Coinbase: major outage and trading halt amid layoffs vs strong on-chain growth" (78 — way over)

If the source narrative is verbose, pick the most evocative 2-4 words. DON'T let the backend truncate mid-word — control the trim yourself.

═══ CONFIDENCE_BPS — USE THE FULL 0-10000 RANGE ═══
Don't cluster every spawn at 6000-7800. Spread your scores so the threshold (4000) is meaningful:

- 9000–10000:  landmark cultural moment, sustained attention, multi-day story.   (rare per cycle)
- 7000–9000:   strong signal, real story, durable interest.                       (most spawns)
- 5000–7000:   real but niche, fading, or speculative.                           (borderline spawns)
- 3000–5000:   weak — almost always skip.
- 0–3000:      noise — return verdict=skip.

═══ REASON ═══
For SKIP verdicts: START with one of these CODES followed by a colon and a short note. The codes drive the admin/candidates audit filter:
- "noise_ticker:"         unrecognized ticker that looks like junk or scam
- "low_mentions:"         signal too weak (typically mention_count < 5)
- "generic_word:"         word like "HOLD", "PUMP", "SAFE" — not a real asset
- "irrelevant:"           off-topic for a crypto-attention market
- "duplicate:"            overlaps a candidate already covered better
- "low_signal:"           present but doesn't warrant a market yet
- "identifier_too_long:"  couldn't fit a meaningful slug in 10 bytes
- "low_confidence:"       borderline — could go either way

For SPAWN/MERGE verdicts: freeform single sentence (max 100 chars), describing why this is worth tokenizing or what it merges into.

═══ RULES ═══
- Output exactly one decision per input candidate, in order, by index.
- Be ruthless about skipping — better to skip borderline than spam the protocol.
- Cross-reference and merge: "Bitcoin halving narrative" + "BTC" trending token → merge the narrative into the BTC token, not double-spawn.
- If identifier won't fit 10 bytes meaningfully, return skip with "identifier_too_long:".
- If display_name would exceed 32 bytes, trim it yourself to evocative core — don't dump the full source narrative.`;

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    decisions: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          index: { type: "INTEGER" },
          verdict: { type: "STRING", enum: ["spawn", "skip", "merge"] },
          identifier: { type: "STRING" },
          display_name: { type: "STRING" },
          asset_class: { type: "INTEGER" },
          confidence_bps: { type: "INTEGER" },
          reason: { type: "STRING" },
          merged_with_index: { type: "INTEGER", nullable: true },
        },
        required: [
          "index",
          "verdict",
          "identifier",
          "display_name",
          "asset_class",
          "confidence_bps",
          "reason",
        ],
      },
    },
  },
  required: ["decisions"],
};

export type JudgeOutcome =
  | { ok: true; decisions: JudgeDecision[] }
  | { ok: false; reason: "no_key" | "rate_limited" | "http_error" | "invalid_json" | "fetch_failed" };

export async function judgeCandidates(
  candidates: JudgeCandidate[],
): Promise<JudgeOutcome> {
  if (!config.GEMINI_API_KEY) return { ok: false, reason: "no_key" };
  if (candidates.length === 0) return { ok: true, decisions: [] };

  const indexed = candidates.map((c, i) => ({ index: i, kind: c.kind, ...c.payload }));
  const userText = `Judge the following ${candidates.length} candidate(s). Return one decision per index.\n\n${JSON.stringify(indexed, null, 2)}`;

  const url = `${ENDPOINT}/${config.GEMINI_MODEL}:generateContent?key=${config.GEMINI_API_KEY}`;
  const body = {
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [{ role: "user", parts: [{ text: userText }] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
      temperature: 0.2,
    },
  };

  const started = Date.now();
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (e: any) {
    log.warn({ err: e?.message }, "Gemini fetch failed");
    return { ok: false, reason: "fetch_failed" };
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "<no body>");
    if (res.status === 429) {
      log.warn(
        { status: 429, body: text.slice(0, 200) },
        "Gemini quota exhausted (429) — skipping AI gate this cycle",
      );
      return { ok: false, reason: "rate_limited" };
    }
    log.warn({ status: res.status, body: text.slice(0, 400) }, "Gemini judge HTTP error");
    return { ok: false, reason: "http_error" };
  }

  const json: any = await res.json().catch(() => null);
  const raw = json?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!raw) {
    log.warn({ json }, "Gemini judge: empty response");
    return { ok: false, reason: "invalid_json" };
  }

  let parsed: { decisions?: JudgeDecision[] };
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    log.warn({ raw: raw.slice(0, 400) }, "Gemini judge: invalid JSON");
    return { ok: false, reason: "invalid_json" };
  }

  const decisions = (parsed.decisions ?? []).filter(
    (d) => typeof d?.index === "number" && d.index >= 0 && d.index < candidates.length,
  );

  log.info(
    {
      elapsedMs: Date.now() - started,
      candidates: candidates.length,
      decisions: decisions.length,
      spawn: decisions.filter((d) => d.verdict === "spawn").length,
      skip: decisions.filter((d) => d.verdict === "skip").length,
      merge: decisions.filter((d) => d.verdict === "merge").length,
    },
    "Gemini judge complete",
  );

  return { ok: true, decisions };
}
