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

VERDICTS:
- "spawn": worth tokenizing. It is a coherent, distinct cultural moment / asset / topic with real attention.
- "skip": noise (greetings, generic words, scam tickers, dead memes, duplicates of clearly stronger candidates, gibberish, off-topic).
- "merge": this candidate refers to the same underlying topic as another candidate in this batch — point at the stronger one via merged_with_index.

ASSET CLASS (use this exact mapping):
- 0 = crypto (major tickers like BTC, ETH, SOL)
- 1 = dex / pool token
- 2 = equity (NVDA, TSLA, SPX, AAPL)
- 3 = commodity (XAU, CL, ZW, NG)
- 4 = fx (DXY, EURUSD)
- 5 = solana contract address (44-char base58) — CURRENTLY UNSPAWNABLE, prefer skip or merge
- 6 = trend / cultural / narrative (memes, movements, aesthetics, events)

IDENTIFIER FORMAT — HARD CAP 10 BYTES TOTAL. The on-chain program derives the SPL token symbol verbatim from this, and Metaplex caps symbols at 10 bytes. The lowercase "a" / "ax" prefixes mark this as an ATTENTION TOKEN — what we sell here is mindshare, not the underlying. So aBTC means "attention BTC", axNVDA means "attention Nvidia equity", etc.

  - Class 0/1 (crypto, dex): "a" + UPPERCASE TICKER (2-9 chars). Examples: aBTC, aETH, aSOL, aPEPE, aWIF, aBONK, aJUP
  - Class 2/3/4 (equity, commodity, fx): "ax" + UPPERCASE TICKER (2-8 chars). Examples: axNVDA, axSPX, axTSLA, axAAPL, axXAU, axDXY, axEURUSD
  - Class 6 (trend): camelCase, NO prefix, 2-10 chars total. Pick the SHORTEST evocative tag. Examples:
      "Anthropic partners with SpaceX..." → "anthSpacex"
      "Chinese Baddies aesthetic"          → "cnbadd" or "baddies"
      "Massie endorses Bitcoin"            → "massieBtc"
      "XRPL interbank settlement"          → "xrplBank"
      "Bitcoin halving narrative"          → "btcHalv"
    Use lowercase first letter, then either lowercase or camelCase remainder. NO colons, NO dashes, NO underscores — just letters and digits.

DISPLAY_NAME (separate field): full human-readable label, Title Case, e.g. "Bitcoin", "Nvidia", "Chinese Baddies Aesthetic", "Anthropic SpaceX Partnership". The display_name is what users SEE; the identifier is just the on-chain id.

IF YOU CANNOT FIT a meaningful identifier in 10 bytes, return verdict="skip" with reason="identifier_too_long". Do not return spawn with an over-cap identifier — the validator will reject and the candidate will be dropped anyway.

DISPLAY NAME: short, Title Case, human-friendly (e.g. "Chinese Baddies Aesthetic", "Bitcoin", "Anthropic x SpaceX Deal").

CONFIDENCE_BPS: 0–10000 basis points expressing how confident you are this is a real, durable hype event. Use the full range:
- 8000+: clear, widely-discussed cultural moment with strong signal
- 5000–8000: real but niche or fading
- 3000–5000: borderline, weak signal
- <3000: probably noise (use verdict=skip then)

REASON: one short sentence (under 20 words). No hype, no fluff, just what makes it spawn-worthy or noise.

RULES:
- Output exactly one decision per input candidate, in order, indexed.
- Be ruthless about skipping: it's better to skip a borderline candidate than spam the protocol.
- If a token symbol looks like a generic word ("HOLD", "SAFE", "PUMP"), check the metrics — low mentions = skip.
- Merge collapse example: a "Bitcoin halving narrative" + "BTC trending token" should merge the narrative into the BTC token, not double-spawn.
- For trend candidates, the slug should preserve the meme's identity, not be a literal sentence summary.`;

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
