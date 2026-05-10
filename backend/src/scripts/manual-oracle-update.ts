// bun run oracle:update -- --identifier BTC --bps 2500
import { oracleUpdater } from "../services/oracle-updater";
import * as db from "../db";

const args = process.argv.slice(2);
const identifier = args[args.indexOf("--identifier") + 1];
const bps = Number(args[args.indexOf("--bps") + 1]);

if (!identifier || isNaN(bps)) {
  console.error(
    "Usage: bun run oracle:update -- --identifier BTC --bps 2500",
  );
  process.exit(1);
}

const market = await db.getMarketByIdentifier(identifier);
if (!market) {
  console.error(`Market "${identifier}" not in DB`);
  process.exit(1);
}

await oracleUpdater.submit(market.pda, identifier, bps);
console.log("Done");
process.exit(0);
