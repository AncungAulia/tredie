import { Hono } from "hono";
import { z } from "zod";
import * as db from "../db";

export const autoQueriesRoutes = new Hono();

const jsonSafe = (v: unknown): unknown =>
  JSON.parse(
    JSON.stringify(v, (_, x) => (typeof x === "bigint" ? x.toString() : x)),
  );

const listSchema = z.object({
  status: z.enum(["active", "cancelled", "expired", "failed"]).optional(),
  marketPda: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});

autoQueriesRoutes.get("/", async (c) => {
  const parsed = listSchema.safeParse({
    status: c.req.query("status"),
    marketPda: c.req.query("marketPda"),
    limit: c.req.query("limit"),
  });
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const rows = await db.listAutoQueries(parsed.data);

  // Aggregate counts per status for dashboard
  const counts = rows.reduce(
    (acc, r) => ({ ...acc, [r.status]: (acc[r.status] ?? 0) + 1 }),
    {} as Record<string, number>,
  );

  return c.json(
    jsonSafe({
      autoQueries: rows,
      counts,
      total: rows.length,
    }),
  );
});
