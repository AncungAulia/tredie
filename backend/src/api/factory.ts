import { Hono } from "hono";
import { connection } from "../solana/connection";
import { factoryPda } from "../solana/pda";
import { decodeFactory } from "../solana/decoder";
import { sql } from "../db";

export const factoryRoutes = new Hono();

const jsonSafe = (v: unknown): unknown =>
  JSON.parse(
    JSON.stringify(v, (_, x) => (typeof x === "bigint" ? x.toString() : x)),
  );

factoryRoutes.get("/", async (c) => {
  const [factory] = factoryPda();
  const acc = await connection.getAccountInfo(factory);
  if (!acc) {
    return c.json({ error: "Factory not initialized on-chain" }, 404);
  }

  let decoded;
  try {
    decoded = decodeFactory(acc.data);
  } catch (e: any) {
    return c.json({ error: `Failed to decode factory: ${e.message}` }, 500);
  }

  // Cross-check with DB market count
  const [{ db_count }] = await sql<{ db_count: bigint }[]>`
    SELECT COUNT(*)::bigint AS db_count FROM markets
  `;

  // Per-asset-class breakdown
  const breakdown = await sql<{ asset_class: number; count: bigint }[]>`
    SELECT asset_class, COUNT(*)::bigint AS count
    FROM markets
    GROUP BY asset_class
    ORDER BY asset_class
  `;

  return c.json(
    jsonSafe({
      factory: {
        ...decoded,
        pda: factory.toBase58(),
      },
      dbMarketCount: db_count,
      assetClassBreakdown: breakdown.reduce(
        (acc, r) => ({ ...acc, [r.asset_class]: r.count }),
        {} as Record<number, bigint>,
      ),
    }),
  );
});
