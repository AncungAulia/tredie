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
            identifier: q,
            display_name: meta?.symbol ?? null,
            asset_class: market?.asset_class ?? 5,
            pda: market?.pda ?? null,
            suggestion_type: "ca_suggestion" as const,
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
    identifier: m.identifier,
    display_name: m.display_name ?? null,
    asset_class: m.asset_class,
    pda: m.pda ?? null,
    suggestion_type: "market" as const,
  }));
  return c.json({ suggestions });
});
