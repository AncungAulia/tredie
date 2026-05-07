import { Hono } from "hono";
import { sql } from "../db";
import * as db from "../db";

export const searchRoutes = new Hono();

const jsonSafe = (v: unknown): unknown =>
  JSON.parse(
    JSON.stringify(v, (_, x) => (typeof x === "bigint" ? x.toString() : x)),
  );

searchRoutes.get("/", async (c) => {
  const q = (c.req.query("q") ?? "").trim();
  if (q.length < 2) return c.json({ suggestions: [] });

  const isCA = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(q);
  if (isCA) {
    const meta = await db.getTokenMetadata(q);
    const market = await db.getMarketByIdentifier(q);
    return c.json(
      jsonSafe({
        suggestions: [
          {
            type: "ca",
            value: q,
            display: `${meta?.symbol ?? "Unknown"} · ${q.slice(0, 6)}...${q.slice(-4)}`,
            marketPda: market?.pda,
          },
        ],
      }),
    );
  }

  const like = `%${q.toUpperCase()}%`;
  const markets = await sql<db.MarketRow[]>`
    SELECT * FROM markets
    WHERE UPPER(identifier) LIKE ${like} OR UPPER(display_name) LIKE ${like}
    LIMIT 8
  `;

  const suggestions = markets.map((m) => ({
    type:
      m.asset_class === 5 ? "ca"
      : m.asset_class === 6 ? "trend"
      : "symbol",
    value: m.identifier,
    display: m.display_name
      ? `${m.identifier} · ${m.display_name}`
      : m.identifier,
    marketPda: m.pda,
    ratchetBps: m.ratchet_multiplier_bps,
  }));
  return c.json({ suggestions });
});
