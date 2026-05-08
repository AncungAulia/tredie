import { marketSpawner } from "../services/market-spawner";
import { log } from "../utils/log";

const SEEDS = [
  // Crypto tickers (asset_class 0)
  { identifier: "BTC", assetClass: 0 },
  { identifier: "ETH", assetClass: 0 },
  { identifier: "SOL", assetClass: 0 },
  { identifier: "BONK", assetClass: 0 },
  { identifier: "WIF", assetClass: 0 },
  { identifier: "JUP", assetClass: 0 },
  // Equities / commodities / FX via xyz: prefix (HIP-3, asset_class 2-4)
  { identifier: "xyz:NVDA", assetClass: 2, displayName: "Nvidia" },
  { identifier: "xyz:TSLA", assetClass: 2, displayName: "Tesla" },
  { identifier: "xyz:AAPL", assetClass: 2, displayName: "Apple" },
  { identifier: "xyz:XAU", assetClass: 3, displayName: "Gold" },
  { identifier: "xyz:CL", assetClass: 3, displayName: "Crude Oil" },
  { identifier: "xyz:DXY", assetClass: 4, displayName: "DXY" },
  // Trend/meme markets (asset_class 6) — tokenize attention itself.
  // Identifier format: "t:<slug>" capped at 10 bytes total (MPL symbol cap).
  { identifier: "t:cnbadd", assetClass: 6, displayName: "Chinese Baddies" },
  { identifier: "t:aiagent", assetClass: 6, displayName: "AI Agents" },
  { identifier: "t:labubu", assetClass: 6, displayName: "Labubu" },
  { identifier: "t:ozempic", assetClass: 6, displayName: "Ozempic" },
];

for (const s of SEEDS) {
  try {
    log.info({ identifier: s.identifier }, "Seeding...");
    await marketSpawner.ensureMarket({
      identifier: s.identifier,
      assetClass: s.assetClass,
      source: "auto_spawn",
      displayName: (s as any).displayName ?? null,
    });
    await new Promise((r) => setTimeout(r, 2000));
  } catch (e: any) {
    log.error(
      { err: e.message, identifier: s.identifier },
      "Seed failed",
    );
  }
}
process.exit(0);
