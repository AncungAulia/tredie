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
- 2 = equity (NVDA, TSLA — prefix raw symbol with "xyz:" for non-crypto)
- 3 = commodity
- 4 = fx
- 5 = solana contract address (44-char base58) — CURRENTLY UNSPAWNABLE, prefer skip or merge
- 6 = trend / cultural / narrative (everything else: memes, movements, aesthetics, events)

IDENTIFIER FORMAT — HARD CAP 10 BYTES TOTAL because the on-chain program derives the SPL token symbol verbatim from this identifier and Metaplex caps symbols at 10 bytes:
- Crypto/equity tickers: uppercase, 2–10 chars ("BTC", "ETH", "SOL", "PEPE")
- Equity/commodity/fx with "xyz:" prefix: total ≤10 bytes ("xyz:NVDA", "xyz:SPX", "xyz:XAU")
- Trend: "t:<slug>" — slug is lowercase kebab-case, total ≤10 bytes (so slug part max 8 chars). Pick the SHORTEST evocative tag, not a sentence. Examples:
    "Anthropic partners with SpaceX..." → "t:anthspx"
    "Chinese Baddies aesthetic"          → "t:cnbadd" or "t:baddies"
    "Massie endorses Bitcoin"            → "t:massie"
    "XRPL interbank settlement"          → "t:xrpl"
  When in doubt, use 1-2 highly distinctive lowercase letter sequences. The full readable name goes in display_name, not identifier.

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

export async function judgeCandidates(
  candidates: JudgeCandidate[],
): Promise<JudgeDecision[] | null> {
  if (!config.GEMINI_API_KEY || candidates.length === 0) return null;

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
    return null;
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "<no body>");
    log.warn({ status: res.status, body: text.slice(0, 400) }, "Gemini judge HTTP error");
    return null;
  }

  const json: any = await res.json().catch(() => null);
  const raw = json?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!raw) {
    log.warn({ json }, "Gemini judge: empty response");
    return null;
  }

  let parsed: { decisions?: JudgeDecision[] };
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    log.warn({ raw: raw.slice(0, 400) }, "Gemini judge: invalid JSON");
    return null;
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

  return decisions;
}
