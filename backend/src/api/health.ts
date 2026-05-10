import { Hono } from "hono";
import { connection } from "../solana/connection";
import { sql } from "../db";
import { config } from "../config";
import ky from "ky";

export const healthRoutes = new Hono();

const jsonSafe = (v: unknown): unknown =>
  JSON.parse(
    JSON.stringify(v, (_, x) => (typeof x === "bigint" ? x.toString() : x)),
  );

async function checkDb(): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
  const t0 = Date.now();
  try {
    const [row] = await sql<{ block_time: bigint | null }[]>`
      SELECT block_time FROM trades ORDER BY block_time DESC LIMIT 1
    `;
    return { ok: true, latencyMs: Date.now() - t0, ...(row && { lastTrade: row.block_time?.toString() }) };
  } catch (e: any) {
    return { ok: false, latencyMs: Date.now() - t0, error: e.message };
  }
}

async function checkSolana(): Promise<{ ok: boolean; latencyMs: number; slot?: number; error?: string }> {
  const t0 = Date.now();
  try {
    const slot = await connection.getSlot();
    return { ok: true, latencyMs: Date.now() - t0, slot };
  } catch (e: any) {
    return { ok: false, latencyMs: Date.now() - t0, error: e.message };
  }
}

async function checkElfa(): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
  const t0 = Date.now();
  try {
    await ky
      .get(`${config.ELFA_API_BASE}/v2/ping`, {
        headers: { "x-elfa-api-key": config.ELFA_API_KEY },
        timeout: 8_000,
        retry: 0,
      })
      .json();
    return { ok: true, latencyMs: Date.now() - t0 };
  } catch (e: any) {
    return { ok: false, latencyMs: Date.now() - t0, error: e.message };
  }
}

// Combined: top-level health, untuk monitoring/uptime checks
healthRoutes.get("/", async (c) => {
  const [db, sol] = await Promise.all([checkDb(), checkSolana()]);
  const allOk = db.ok && sol.ok;

  const [last] = await sql<{ block_time: bigint | null }[]>`
    SELECT block_time FROM trades ORDER BY block_time DESC LIMIT 1
  `.catch(() => [{ block_time: null }]);

  return c.json(
    jsonSafe({
      ok: allOk,
      version: "0.1.0",
      stack: "hono+supabase",
      slot: sol.slot ?? 0,
      lastIndexedTrade: last?.block_time?.toString() ?? null,
      checks: { db: db.ok, solana: sol.ok },
    }),
    allOk ? 200 : 503,
  );
});

// Granular probes — frontend / monitoring bisa pinpoint komponen mana yang down
healthRoutes.get("/db", async (c) => {
  const r = await checkDb();
  return c.json(jsonSafe(r), r.ok ? 200 : 503);
});

healthRoutes.get("/solana", async (c) => {
  const r = await checkSolana();
  return c.json(jsonSafe(r), r.ok ? 200 : 503);
});

healthRoutes.get("/elfa", async (c) => {
  const r = await checkElfa();
  return c.json(jsonSafe(r), r.ok ? 200 : 503);
});
