/**
 * Gemini fallback untuk Elfa AI Chat (/v2/chat).
 *
 * Endpoint chat Elfa cuma tersedia di plan Grow / Pay-as-you-go; di plan gratis
 * dia balas 403 ERR_FORBIDDEN. Dua fitur bergantung ke sana — market ai-context
 * dan trend extraction di symbol-extractor — jadi tanpa fallback keduanya mati.
 * Gemini sudah jadi dependency (dipakai gemini-judge) dan kuncinya sama, jadi
 * dipakai ulang di sini alih-alih menambah provider baru.
 */
import { config } from "../config";
import { log } from "../utils/log";

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

export async function geminiChat(message: string): Promise<string> {
  if (!config.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not set");

  const url = `${ENDPOINT}/${config.GEMINI_MODEL}:generateContent?key=${config.GEMINI_API_KEY}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: message }] }],
      generationConfig: { temperature: 0.4 },
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "<no body>");
    throw new Error(`Gemini chat ${res.status}: ${body.slice(0, 200)}`);
  }

  const json: any = await res.json();
  const text = json?.candidates?.[0]?.content?.parts
    ?.map((p: any) => p?.text ?? "")
    .join("")
    .trim();

  if (!text) {
    log.warn({ json }, "Gemini chat: empty response");
    throw new Error("Gemini chat returned empty response");
  }
  return text;
}
