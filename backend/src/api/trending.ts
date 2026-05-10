import { Hono } from "hono";
import { sql } from "../db";

export const trendingRoutes = new Hono();

const jsonSafe = (v: unknown): unknown =>
  JSON.parse(
    JSON.stringify(v, (_, x) => (typeof x === "bigint" ? x.toString() : x)),
  );

trendingRoutes.get("/tokens", async (c) => {
  const threshold = BigInt(Date.now() - 20 * 60 * 1000);
  const rows = await sql`
    SELECT DISTINCT ON (tt.symbol)
      tt.*, m.pda AS market_pda, m.ratchet_multiplier_bps, m.real_sol_reserves
    FROM trending_tokens tt
    LEFT JOIN markets m ON m.identifier = tt.symbol
    WHERE tt.fetched_at > ${threshold}
    ORDER BY tt.symbol, tt.fetched_at DESC
  `;
  const sorted = [...rows]
    .sort(
      (a: any, b: any) =>
        (a.rank_position ?? 999) - (b.rank_position ?? 999),
    )
    .slice(0, 50);
  return c.json(jsonSafe({ tokens: sorted }));
});

trendingRoutes.get("/cas/:platform", async (c) => {
  const platform = c.req.param("platform");
  if (!["twitter", "telegram"].includes(platform)) {
    return c.json({ error: "platform must be twitter or telegram" }, 400);
  }
  const threshold = BigInt(Date.now() - 20 * 60 * 1000);
  const rows = await sql`
    SELECT DISTINCT ON (tc.contract_address)
      tc.*, tm.symbol, tm.name, tm.image_url,
      m.pda AS market_pda, m.ratchet_multiplier_bps
    FROM trending_cas tc
    LEFT JOIN token_metadata tm ON tm.contract_address = tc.contract_address
    LEFT JOIN markets m ON m.identifier = tc.contract_address
    WHERE tc.source_platform = ${platform} AND tc.fetched_at > ${threshold}
    ORDER BY tc.contract_address, tc.fetched_at DESC
  `;
  const sorted = [...rows]
    .sort(
      (a: any, b: any) =>
        (a.rank_position ?? 999) - (b.rank_position ?? 999),
    )
    .slice(0, 50);
  return c.json(jsonSafe({ cas: sorted }));
});
