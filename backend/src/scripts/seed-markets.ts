import { marketSpawner } from "../services/market-spawner";
import { log } from "../utils/log";

// Identifier convention (≤10 bytes for MPL symbol cap):
//   crypto/dex (0,1) — "a" + UPPERCASE  (aBTC, aETH)
//   equity/commodity/fx (2,3,4) — "ax" + UPPERCASE  (axNVDA, axXAU, axDXY)
//   trend (6) — camelCase, no prefix    (cnbadd, labubu)
const SEEDS = [
  // Crypto attention tokens (asset_class 0)
  { identifier: "aBTC", assetClass: 0, displayName: "Bitcoin" },
  { identifier: "aETH", assetClass: 0, displayName: "Ethereum" },
  { identifier: "aSOL", assetClass: 0, displayName: "Solana" },
  { identifier: "aBONK", assetClass: 0, displayName: "Bonk" },
  { identifier: "aWIF", assetClass: 0, displayName: "dogwifhat" },
  { identifier: "aJUP", assetClass: 0, displayName: "Jupiter" },
  // Equity / commodity / FX (asset_class 2-4)
  { identifier: "axNVDA", assetClass: 2, displayName: "Nvidia" },
  { identifier: "axTSLA", assetClass: 2, displayName: "Tesla" },
  { identifier: "axAAPL", assetClass: 2, displayName: "Apple" },
  { identifier: "axXAU", assetClass: 3, displayName: "Gold" },
  { identifier: "axCL", assetClass: 3, displayName: "Crude Oil" },
  { identifier: "axDXY", assetClass: 4, displayName: "DXY" },
  // Trend / cultural-moment tokens (asset_class 6) — camelCase, no prefix
  { identifier: "cnbadd", assetClass: 6, displayName: "Chinese Baddies" },
  { identifier: "aiagent", assetClass: 6, displayName: "AI Agents" },
  { identifier: "labubu", assetClass: 6, displayName: "Labubu" },
  { identifier: "ozempic", assetClass: 6, displayName: "Ozempic" },
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
