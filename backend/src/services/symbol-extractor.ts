import * as elfaClient from "../elfa/client";
import * as autoClient from "../elfa/auto-client";
import { metadataEnricher } from "./metadata-enricher";
import type { LinkMetadata } from "./link-resolver";
import { log } from "../utils/log";

export interface ExtractionResult {
  symbol: string | null;
  confidence: "high" | "medium" | "low";
}

/** Pull the first short phrase out of LLM output. Strips markdown, code fences,
 *  and trailing punctuation. Caps at 60 chars so normalizeTrendId() can fit. */
/** LLM kadang balas klarifikasi alih-alih jawaban ketika konteksnya tipis.
 *  Frasa seperti ini tidak boleh lolos jadi ticker/trend id. */
function isNonAnswer(phrase: string): boolean {
  return /^(please|sorry|i (can|cannot|need|am|'m)|as an|there (is|are) no|unable|no clear|none)\b/i.test(
    phrase.trim(),
  );
}

function cleanLLMPhrase(raw: string): string {
  const firstLine = raw.split("\n").map((l) => l.trim()).find((l) => l.length > 0) ?? "";
  return firstLine
    .replace(/^["'`*_#\s>-]+|["'`*_#\s.!?]+$/g, "")
    .replace(/\*\*|__|`/g, "")
    .slice(0, 60);
}

export class SymbolExtractor {
  async extract(meta: LinkMetadata): Promise<ExtractionResult> {
    const text =
      `${meta.title ?? ""} ${meta.description ?? ""} ${meta.authorName ?? ""}`.slice(
        0,
        2000,
      );

    // Konten kosong/terlalu pendek bikin LLM balas kalimat klarifikasi
    // ("Please provide the content...") yang lolos cleanLLMPhrase dan jadi
    // simbol sampah. Berhenti lebih awal daripada menebak dari ampas.
    if (text.trim().length < 8) {
      log.debug({ meta }, "Link metadata too thin — skipping extraction");
      return { symbol: null, confidence: "low" };
    }

    // A. Cashtag
    const cashtag = text.match(/\$([A-Z]{2,10})\b/);
    if (cashtag) {
      const v = await autoClient.validateSymbol(cashtag[1]);
      if (v.supported) {
        log.info({ symbol: cashtag[1], strategy: "cashtag" }, "Symbol extracted");
        return { symbol: cashtag[1], confidence: "high" };
      }
    }

    // B. Solana CA
    const ca = text.match(/\b([1-9A-HJ-NP-Za-km-z]{32,44})\b/);
    if (ca) {
      const m = await metadataEnricher.fetch(ca[1]);
      if (m) {
        log.info({ symbol: ca[1], strategy: "ca" }, "Symbol extracted");
        return { symbol: ca[1], confidence: "high" };
      }
    }

    // C. xyz: prefix probe — cap to 5 candidates to limit Elfa API hits
    const upperWords = text.match(/\b([A-Z]{2,6})\b/g) ?? [];
    for (const w of upperWords.slice(0, 5)) {
      const v = await autoClient.validateSymbol(`xyz:${w}`);
      if (v.supported) {
        log.info({ symbol: `xyz:${w}`, strategy: "xyz-probe" }, "Symbol extracted");
        return { symbol: `xyz:${w}`, confidence: "medium" };
      }
    }

    // D. Elfa Chat — try ticker extraction first
    try {
      const r = await elfaClient.elfaChat(
        `What single financial asset (crypto/equity/commodity) is this content primarily about? ` +
          `Return ONLY the ticker symbol with no other text. Use xyz: prefix for equities/commodities. ` +
          `Return "none" if unclear. Content: ${text.slice(0, 500)}`,
        "fast",
      );
      const cleaned = cleanLLMPhrase(r.message);
      const ticker = isNonAnswer(cleaned) ? "" : cleaned.replace(/[^a-zA-Z0-9:]/g, "");
      if (ticker && ticker.toLowerCase() !== "none") {
        const v = await autoClient.validateSymbol(ticker);
        if (v.supported) {
          log.info({ symbol: ticker, strategy: "elfa-chat-ticker" }, "Symbol extracted");
          return { symbol: ticker, confidence: "medium" };
        }
        log.debug({ ticker, supported: false }, "Elfa Chat ticker not supported");
      }
    } catch (e) {
      log.warn({ err: e }, "Elfa Chat ticker extraction failed");
    }

    // E. Elfa Chat — trend/topic extraction fallback
    try {
      const r = await elfaClient.elfaChat(
        `What single TREND, MEME, TOPIC, or CULTURAL MOMENT is this content primarily about? ` +
          `Return only a short phrase (2-4 words max) and nothing else. Examples: "chinese baddies", ` +
          `"ai agents", "labubu". Return "none" if there's no clear trend. ` +
          `Content: ${text.slice(0, 500)}`,
        "fast",
      );
      const phrase = cleanLLMPhrase(r.message);
      if (phrase && !isNonAnswer(phrase) && phrase.toLowerCase() !== "none") {
        const trendId = elfaClient.normalizeTrendId(phrase);
        if (trendId) {
          log.info({ symbol: trendId, phrase, strategy: "elfa-chat-trend" }, "Symbol extracted");
          return { symbol: trendId, confidence: "low" };
        }
        log.debug({ phrase }, "Trend phrase failed normalization (>32 bytes after slug)");
      }
    } catch (e) {
      log.warn({ err: e }, "Elfa Chat trend extraction failed");
    }

    log.debug({ titleSnippet: text.slice(0, 80) }, "No symbol extracted");
    return { symbol: null, confidence: "low" };
  }
}

export const symbolExtractor = new SymbolExtractor();
