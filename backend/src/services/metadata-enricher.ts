import * as db from "../db";
import { config } from "../config";
import { log } from "../utils/log";

export class MetadataEnricher {
  async fetch(addr: string): Promise<db.TokenMetadataRow | null> {
    const cached = await db.getTokenMetadata(addr);
    if (cached && Date.now() - Number(cached.fetched_at) < 24 * 60 * 60 * 1000) {
      return cached;
    }

    // 1. Helius DAS (getAsset)
    try {
      const res = await fetch(config.SOLANA_RPC_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: "1",
          method: "getAsset",
          params: { id: addr },
        }),
      });
      const data: any = await res.json();
      if (data.result) {
        const meta: db.TokenMetadataRow = {
          contract_address: addr,
          symbol: data.result.content?.metadata?.symbol ?? null,
          name: data.result.content?.metadata?.name ?? null,
          image_url: data.result.content?.links?.image ?? null,
          decimals: data.result.token_info?.decimals ?? null,
          total_supply: null,
          source: "helius_das",
          fetched_at: BigInt(Date.now()),
        };
        await db.cacheTokenMetadata(meta);
        return meta;
      }
    } catch (e) {
      log.debug({ err: e, addr }, "Helius DAS failed");
    }

    // 2. Jupiter strict list
    try {
      const res = await fetch("https://token.jup.ag/strict", {
        signal: AbortSignal.timeout(10_000),
      });
      const list = (await res.json()) as any[];
      const found = list.find((t) => t.address === addr);
      if (found) {
        const meta: db.TokenMetadataRow = {
          contract_address: addr,
          symbol: found.symbol,
          name: found.name,
          image_url: found.logoURI,
          decimals: found.decimals,
          total_supply: null,
          source: "jupiter",
          fetched_at: BigInt(Date.now()),
        };
        await db.cacheTokenMetadata(meta);
        return meta;
      }
    } catch (e) {
      log.debug({ err: e, addr }, "Jupiter fallback failed");
    }

    return null;
  }
}

export const metadataEnricher = new MetadataEnricher();
