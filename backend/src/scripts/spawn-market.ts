// bun run market:spawn -- BTC 0
import { marketSpawner } from "../services/market-spawner";

const [identifier, assetClassRaw] = process.argv.slice(2);
if (!identifier) {
  console.error("Usage: bun run market:spawn -- <identifier> [assetClass=0]");
  process.exit(1);
}

const assetClass = Number(assetClassRaw ?? 0);

marketSpawner
  .ensureMarket({ identifier, assetClass, source: "auto_spawn" })
  .then((m) => {
    console.log("Market:", m.pda);
    process.exit(0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
