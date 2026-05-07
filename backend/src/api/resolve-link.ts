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

  let suggestedMarketPath: string | null = null;
  if (symbol) {
    const market = await db.getMarketByIdentifier(symbol);
    suggestedMarketPath = market
      ? `/markets/${encodeURIComponent(symbol)}`
      : `/markets/${encodeURIComponent(symbol)}?create=true`;
    await db.cacheLinkResolution(
      body.data.url,
      metadata.platform,
      metadata,
      symbol,
    );
  }

  return c.json({
    metadata,
    extractedSymbol: symbol,
    confidence,
    suggestedMarketPath,
  });
});
