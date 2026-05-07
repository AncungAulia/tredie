import ky from "ky";
import { createHmac } from "crypto";
import { config } from "../config";
import type {
  AutoQueryRequest,
  AutoCreateQueryResponse,
  AutoValidateResult,
} from "./types";

/**
 * Elfa Auto outgoing-request HMAC (mutation endpoints only).
 *
 *   payload   = `${timestamp}${METHOD}${mountedPath}${body}`
 *   signature = HMAC-SHA256(payload, ELFA_API_SECRET) → hex (no prefix)
 *   headers   = x-elfa-api-key, x-elfa-timestamp, x-elfa-signature
 *
 * mountedPath = path *setelah* mount /v2/auto. Examples:
 *   POST   /v2/auto/queries              → /queries           (HMAC)
 *   DELETE /v2/auto/queries/{queryId}    → /queries/{queryId} (HMAC)
 *
 * No-HMAC endpoints (per Elfa docs):
 *   POST /v2/auto/queries/validate
 *   POST /v2/auto/queries/preview
 *   POST /v2/auto/queries/drafts            (upsert/get/delete)
 *   GET  /v2/auto/validate-symbol/{symbol}  (free, just needs api-key)
 *
 * Request body for validate/create:
 *   { title?, description?, query: { conditions, actions, expiresIn } }
 */
function sign(method: "GET" | "POST" | "DELETE", mountedPath: string, body: string) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const payload = `${timestamp}${method}${mountedPath}${body}`;
  const signature = createHmac("sha256", config.ELFA_API_SECRET)
    .update(payload)
    .digest("hex");
  return { signature, timestamp };
}

const auto = ky.create({
  baseUrl: config.ELFA_API_BASE,
  headers: { "x-elfa-api-key": config.ELFA_API_KEY },
  timeout: 30_000,
});

const authHeaders = (s: { signature: string; timestamp: string }) => ({
  "x-elfa-signature": s.signature,
  "x-elfa-timestamp": s.timestamp,
});

// ── No-HMAC: validate ────────────────────────────────────────────────────
export async function validateQuery(req: AutoQueryRequest) {
  return auto
    .post("/v2/auto/queries/validate", { json: req })
    .json<AutoValidateResult>();
}

// ── HMAC: create ─────────────────────────────────────────────────────────
export async function createQuery(req: AutoQueryRequest) {
  const body = JSON.stringify(req);
  const s = sign("POST", "/queries", body);
  return auto
    .post("/v2/auto/queries", {
      body,
      headers: { ...authHeaders(s), "Content-Type": "application/json" },
    })
    .json<AutoCreateQueryResponse>();
}

// ── HMAC: cancel (DELETE /v2/auto/queries/{queryId}, body="") ────────────
export async function cancelQuery(queryId: string) {
  const mountedPath = `/queries/${queryId}`;
  const s = sign("DELETE", mountedPath, "");
  await auto.delete(`/v2/auto/queries/${queryId}`, { headers: authHeaders(s) });
}

// ── No-HMAC: validate-symbol (GET, free) ─────────────────────────────────
export async function validateSymbol(symbol: string): Promise<{ supported: boolean }> {
  try {
    return await auto
      .get(`/v2/auto/validate-symbol/${encodeURIComponent(symbol)}`)
      .json<{ supported: boolean }>();
  } catch {
    return { supported: false };
  }
}
