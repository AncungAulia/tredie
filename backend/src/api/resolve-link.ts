import { Hono } from "hono";
import { z } from "zod";
import { linkResolver } from "../services/link-resolver";
import { symbolExtractor } from "../services/symbol-extractor";
import * as db from "../db";

export const resolveLinkRoutes = new Hono();

const schema = z.object({ url: z.string().url() });

resolveLinkRoutes.post("/", async (c) => {
  const body = schema.safeParse(await c.req.json());
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);

  const metadata = await linkResolver.resolve(body.data.url);
  const { symbol, confidence } = await symbolExtractor.extract(metadata);

  let suggested_market_path: string | null = null;
  if (symbol) {
    const market = await db.getMarketByIdentifier(symbol);
    if (market) {
      const base = market.asset_class === 6 ? "/topics" : "/tokens";
      suggested_market_path = `${base}/${encodeURIComponent(symbol)}`;
    }
    await db.cacheLinkResolution(
      body.data.url,
      metadata.platform,
      metadata,
      symbol,
    );
  }

  return c.json({
    metadata,
    extracted_symbol: symbol,
    confidence,
    suggested_market_path,
  });
});
