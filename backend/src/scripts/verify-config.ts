/**
 * verify-config — comprehensive sanity check for .env values + service connectivity.
 *
 * Run: bun run verify:config
 *
 * For each env var: check shape, then probe the service it talks to.
 * Reports which env keys might be misconfigured.
 */

import { createHash, createHmac } from "crypto";
import { Keypair, PublicKey } from "@solana/web3.js";
import postgres from "postgres";
import ky from "ky";
import { config } from "../config";
import { connection } from "../solana/connection";
import { factoryPda } from "../solana/pda";

type Result = "ok" | "warn" | "fail";
const checks: { name: string; result: Result; detail: string }[] = [];

function record(name: string, result: Result, detail: string) {
  checks.push({ name, result, detail });
}

const mask = (s: string, keep = 6) =>
  s.length <= keep * 2 ? "•".repeat(s.length) : `${s.slice(0, keep)}…${s.slice(-4)}`;

// ── 1. DATABASE_URL ──────────────────────────────────────────────────────
async function checkDatabase() {
  if (!config.DATABASE_URL.startsWith("postgresql://")) {
    record("DATABASE_URL", "fail", "Doesn't start with postgresql://");
    return;
  }
  const sql = postgres(config.DATABASE_URL, { ssl: "require", max: 1, connect_timeout: 8 });
  try {
    const [{ count }] = await sql<{ count: bigint }[]>`SELECT COUNT(*)::bigint FROM markets`;
    record("DATABASE_URL", "ok", `connected, markets=${count}`);
  } catch (e: any) {
    record("DATABASE_URL", "fail", e.message);
  } finally {
    await sql.end();
  }
}

// ── 2. SUPABASE_URL + SERVICE_ROLE_KEY ───────────────────────────────────
async function checkSupabase() {
  if (!config.SUPABASE_URL.includes(".supabase.co")) {
    record("SUPABASE_URL", "warn", "Doesn't look like a *.supabase.co host");
  } else {
    record("SUPABASE_URL", "ok", config.SUPABASE_URL);
  }
  if (!config.SUPABASE_SERVICE_ROLE_KEY.startsWith("eyJ")) {
    record("SUPABASE_SERVICE_ROLE_KEY", "fail", "Not a JWT (should start with 'eyJ')");
    return;
  }
  // Hit Supabase REST root with service-role auth
  try {
    const res = await ky
      .get(`${config.SUPABASE_URL}/rest/v1/`, {
        headers: {
          apikey: config.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${config.SUPABASE_SERVICE_ROLE_KEY}`,
        },
        timeout: 8000,
        retry: 0,
        throwHttpErrors: false,
      });
    if (res.ok) {
      record("SUPABASE_SERVICE_ROLE_KEY", "ok", `JWT (${mask(config.SUPABASE_SERVICE_ROLE_KEY)}) accepted by REST`);
    } else {
      record("SUPABASE_SERVICE_ROLE_KEY", "fail", `REST ${res.status}: ${await res.text().then((t) => t.slice(0, 200))}`);
    }
  } catch (e: any) {
    record("SUPABASE_SERVICE_ROLE_KEY", "fail", e.message);
  }
}

// ── 3. SOLANA_RPC_URL + HELIUS_API_KEY ───────────────────────────────────
async function checkSolanaRpc() {
  if (!config.SOLANA_RPC_URL.startsWith("http")) {
    record("SOLANA_RPC_URL", "fail", "Not a valid URL");
    return;
  }
  if (!config.SOLANA_RPC_URL.includes("helius") && !config.SOLANA_RPC_URL.includes("api.devnet")) {
    record("SOLANA_RPC_URL", "warn", "Doesn't look like Helius or devnet — verify manually");
  }
  try {
    const slot = await connection.getSlot();
    record("SOLANA_RPC_URL", "ok", `getSlot()=${slot}`);
  } catch (e: any) {
    record("SOLANA_RPC_URL", "fail", e.message);
  }

  // HELIUS_API_KEY should also work standalone via DAS API (getAsset)
  try {
    const url = `https://devnet.helius-rpc.com/?api-key=${config.HELIUS_API_KEY}`;
    const res = await ky
      .post(url, {
        json: { jsonrpc: "2.0", id: "1", method: "getHealth" },
        timeout: 8000,
        retry: 0,
        throwHttpErrors: false,
      })
      .json<any>();
    if (res.result === "ok") {
      record("HELIUS_API_KEY", "ok", `${mask(config.HELIUS_API_KEY)} accepted (getHealth=ok)`);
    } else {
      record("HELIUS_API_KEY", "fail", `Unexpected response: ${JSON.stringify(res).slice(0, 200)}`);
    }
  } catch (e: any) {
    record("HELIUS_API_KEY", "fail", e.message);
  }
}

// ── 4. TREDIE_PROGRAM_ID + factory ───────────────────────────────────────
async function checkProgram() {
  let programPk: PublicKey;
  try {
    programPk = new PublicKey(config.TREDIE_PROGRAM_ID);
  } catch {
    record("TREDIE_PROGRAM_ID", "fail", "Not a valid base58 pubkey");
    return;
  }

  try {
    const acc = await connection.getAccountInfo(programPk);
    if (!acc) {
      record("TREDIE_PROGRAM_ID", "fail", "Program account not found on-chain");
      return;
    }
    if (!acc.executable) {
      record("TREDIE_PROGRAM_ID", "fail", "Account exists but not executable");
      return;
    }
    record("TREDIE_PROGRAM_ID", "ok", `${mask(config.TREDIE_PROGRAM_ID, 8)} executable on-chain`);
  } catch (e: any) {
    record("TREDIE_PROGRAM_ID", "fail", e.message);
    return;
  }

  // Factory PDA must be initialized
  try {
    const [factoryPk] = factoryPda();
    const acc = await connection.getAccountInfo(factoryPk);
    if (!acc) {
      record("Factory PDA", "fail", "Not initialized — run `bun run factory:init`");
    } else {
      record("Factory PDA", "ok", `${mask(factoryPk.toBase58(), 6)} owner=${mask(acc.owner.toBase58(), 6)}`);
    }
  } catch (e: any) {
    record("Factory PDA", "fail", e.message);
  }
}

// ── 5. SIGNER_PRIVATE_KEY ────────────────────────────────────────────────
async function checkSigner() {
  let kp: Keypair;
  try {
    const arr = JSON.parse(config.SIGNER_PRIVATE_KEY) as number[];
    if (!Array.isArray(arr) || arr.length !== 64) {
      record("SIGNER_PRIVATE_KEY", "fail", `Expected 64-byte JSON array, got ${arr?.length ?? "non-array"}`);
      return;
    }
    kp = Keypair.fromSecretKey(Uint8Array.from(arr));
  } catch (e: any) {
    record("SIGNER_PRIVATE_KEY", "fail", `Invalid: ${e.message}`);
    return;
  }
  try {
    const lamports = await connection.getBalance(kp.publicKey);
    const sol = (lamports / 1e9).toFixed(4);
    if (lamports < 0.1 * 1e9) {
      record("SIGNER_PRIVATE_KEY", "warn", `pubkey=${mask(kp.publicKey.toBase58(), 8)} balance=${sol} SOL — low, airdrop more`);
    } else {
      record("SIGNER_PRIVATE_KEY", "ok", `pubkey=${mask(kp.publicKey.toBase58(), 8)} balance=${sol} SOL`);
    }
  } catch (e: any) {
    record("SIGNER_PRIVATE_KEY", "warn", `Couldn't fetch balance: ${e.message}`);
  }
}

// ── 6. ELFA_API_KEY (read-only, /v2/key-status) ──────────────────────────
async function checkElfaKey() {
  if (!config.ELFA_API_KEY.startsWith("elfak_")) {
    record("ELFA_API_KEY", "fail", "Should start with 'elfak_' (per Elfa convention)");
    return;
  }
  try {
    const res = await ky
      .get(`${config.ELFA_API_BASE}/v2/key-status`, {
        headers: { "x-elfa-api-key": config.ELFA_API_KEY },
        timeout: 10_000,
        retry: 0,
      })
      .json<any>();
    const tier = res?.data?.tier ?? "?";
    const remaining = res?.data?.remainingRequests?.daily ?? "?";
    const hmacEnabled = res?.data?.hmacEnabled;
    const scopes = res?.data?.scopes ?? [];
    record(
      "ELFA_API_KEY",
      "ok",
      `tier=${tier} daily-remaining=${remaining} hmac=${hmacEnabled} scopes=${scopes.length}`,
    );
    if (!hmacEnabled) {
      record("ELFA_API_KEY (hmac)", "warn", "hmacEnabled=false on this key — Auto mutations will fail");
    }
    return scopes;
  } catch (e: any) {
    record("ELFA_API_KEY", "fail", e.message);
    return [];
  }
}

// ── 7. ELFA_API_SECRET (HMAC for Auto outgoing) ──────────────────────────
async function checkElfaSecret() {
  if (!config.ELFA_API_SECRET) {
    record("ELFA_API_SECRET", "fail", "Empty — Auto mutations will fail");
    return;
  }
  if (config.ELFA_API_SECRET.length < 16) {
    record("ELFA_API_SECRET", "warn", `Suspiciously short (${config.ELFA_API_SECRET.length} chars)`);
  }
  // Test by hitting POST /v2/auto/queries/validate (no HMAC needed) first
  // to confirm key works. Then hit DELETE on a non-existent queryId to test
  // HMAC signing — should get 404 not 401, proving signature was accepted.
  const fakeQueryId = "q_verify_" + Date.now();
  const mountedPath = `/queries/${fakeQueryId}`;
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const payload = `${timestamp}DELETE${mountedPath}`;
  const sig = createHmac("sha256", config.ELFA_API_SECRET).update(payload).digest("hex");

  try {
    const res = await ky.delete(`${config.ELFA_API_BASE}/v2/auto/queries/${fakeQueryId}`, {
      headers: {
        "x-elfa-api-key": config.ELFA_API_KEY,
        "x-elfa-timestamp": timestamp,
        "x-elfa-signature": sig,
      },
      timeout: 10_000,
      retry: 0,
      throwHttpErrors: false,
    });
    if (res.status === 401 || res.status === 403) {
      const body = await res.text();
      record(
        "ELFA_API_SECRET",
        "fail",
        `HMAC rejected (HTTP ${res.status}): ${body.slice(0, 200)} — secret mismatch`,
      );
    } else if (res.status === 404 || res.status === 400) {
      record("ELFA_API_SECRET", "ok", `HMAC accepted (got ${res.status} for fake queryId, as expected)`);
    } else {
      record(
        "ELFA_API_SECRET",
        "warn",
        `Unexpected HTTP ${res.status}: ${await res.text().then((t) => t.slice(0, 200))}`,
      );
    }
  } catch (e: any) {
    record("ELFA_API_SECRET", "fail", e.message);
  }
}

// ── 8. ELFA_AUTO_WEBHOOK_SECRET (HMAC for inbound webhook) ───────────────
async function checkElfaWebhookSecret() {
  if (!config.ELFA_AUTO_WEBHOOK_SECRET) {
    record("ELFA_AUTO_WEBHOOK_SECRET", "warn", "Empty — inbound webhook verification will fail");
    return;
  }
  // Build a synthetic webhook payload signed with our secret, send to our own
  // /api/webhooks/elfa, expect 202 (or 200 duplicate). If 401 → secret
  // mismatch between signer (here) and verifier (handler).
  const eventId = "evt_verify_" + Date.now();
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const body = JSON.stringify({ queryId: "q_verify_dummy", eventType: "verify.test" });
  const signingKey = createHash("sha256").update(config.ELFA_AUTO_WEBHOOK_SECRET).digest();
  const sig = createHmac("sha256", signingKey).update(`${timestamp}.${eventId}.${body}`).digest("hex");

  try {
    const res = await ky.post(`${config.BACKEND_URL}/api/webhooks/elfa`, {
      headers: {
        "Content-Type": "application/json",
        "x-auto-signature": `v1=${sig}`,
        "x-auto-signature-timestamp": timestamp,
        "x-auto-event-id": eventId,
      },
      body,
      timeout: 8000,
      retry: 0,
      throwHttpErrors: false,
    });
    if (res.status === 202 || res.status === 200) {
      record(
        "ELFA_AUTO_WEBHOOK_SECRET",
        "ok",
        `Self-signed test event accepted (HTTP ${res.status})`,
      );
    } else if (res.status === 401) {
      record(
        "ELFA_AUTO_WEBHOOK_SECRET",
        "fail",
        `Self-signed test rejected with 401 — verifier and signer disagree on secret value or signing scheme`,
      );
    } else {
      record(
        "ELFA_AUTO_WEBHOOK_SECRET",
        "warn",
        `Unexpected HTTP ${res.status}: ${await res.text().then((t) => t.slice(0, 200))}`,
      );
    }
  } catch (e: any) {
    record(
      "ELFA_AUTO_WEBHOOK_SECRET",
      "warn",
      `Couldn't reach backend at ${config.BACKEND_URL}: ${e.message}`,
    );
  }
}

// ── 9. HELIUS_WEBHOOK_SECRET (Bearer for inbound) ────────────────────────
async function checkHeliusWebhookSecret() {
  if (!config.HELIUS_WEBHOOK_SECRET) {
    record(
      "HELIUS_WEBHOOK_SECRET",
      "warn",
      "Empty — backend will accept any Helius webhook (production-unsafe)",
    );
    return;
  }
  // Send empty Helius payload with Bearer header. If 200 → backend accepted bearer.
  // If 401 → mismatch.
  try {
    const res = await ky.post(`${config.BACKEND_URL}/api/webhooks/helius`, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.HELIUS_WEBHOOK_SECRET}`,
      },
      json: [],
      timeout: 8000,
      retry: 0,
      throwHttpErrors: false,
    });
    if (res.status === 200) {
      record(
        "HELIUS_WEBHOOK_SECRET",
        "ok",
        `Self-test bearer accepted by backend`,
      );
    } else if (res.status === 401) {
      record(
        "HELIUS_WEBHOOK_SECRET",
        "fail",
        `Self-test bearer rejected (401) — value mismatch`,
      );
    } else {
      record(
        "HELIUS_WEBHOOK_SECRET",
        "warn",
        `Unexpected HTTP ${res.status}`,
      );
    }
  } catch (e: any) {
    record(
      "HELIUS_WEBHOOK_SECRET",
      "warn",
      `Couldn't reach backend: ${e.message}`,
    );
  }
}

// ── Cross-check: common typo — ELFA_API_SECRET == ELFA_AUTO_WEBHOOK_SECRET? ─
function crossCheck() {
  if (
    config.ELFA_API_SECRET &&
    config.ELFA_AUTO_WEBHOOK_SECRET &&
    config.ELFA_API_SECRET === config.ELFA_AUTO_WEBHOOK_SECRET
  ) {
    record(
      "Cross-check (Elfa secrets)",
      "warn",
      "ELFA_API_SECRET == ELFA_AUTO_WEBHOOK_SECRET — usually these are different keys generated separately. Verify on Elfa dashboard.",
    );
  }
  if (config.HELIUS_API_KEY === config.HELIUS_WEBHOOK_SECRET) {
    record(
      "Cross-check (Helius keys)",
      "warn",
      "HELIUS_API_KEY == HELIUS_WEBHOOK_SECRET — these are different things. API key is from Helius dashboard, webhook secret is what you set in 'Authentication Header' field when creating webhook.",
    );
  }
}

// ── Run all ──────────────────────────────────────────────────────────────
(async () => {
  console.log("\n  Running config audit...\n");

  await checkDatabase();
  await checkSupabase();
  await checkSolanaRpc();
  await checkProgram();
  await checkSigner();
  await checkElfaKey();
  await checkElfaSecret();
  await checkElfaWebhookSecret();
  await checkHeliusWebhookSecret();
  crossCheck();

  // Print as table
  const pad = (s: string, n: number) => s.length >= n ? s : s + " ".repeat(n - s.length);
  console.log("─".repeat(110));
  console.log(`${pad("STATUS", 8)} ${pad("CHECK", 32)} DETAIL`);
  console.log("─".repeat(110));
  for (const c of checks) {
    const icon = c.result === "ok" ? "✓ ok" : c.result === "warn" ? "! warn" : "✗ FAIL";
    console.log(`${pad(icon, 8)} ${pad(c.name, 32)} ${c.detail}`);
  }
  console.log("─".repeat(110));

  const fail = checks.filter((c) => c.result === "fail").length;
  const warn = checks.filter((c) => c.result === "warn").length;
  const ok = checks.filter((c) => c.result === "ok").length;
  console.log(`\n  Summary: ${ok} ok, ${warn} warn, ${fail} FAIL\n`);

  process.exit(fail > 0 ? 1 : 0);
})();
