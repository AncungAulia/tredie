import { cors } from "hono/cors";
import { logger as honoLogger } from "hono/logger";
import { buildRouter } from "./api/routes";
import { config } from "./config";
import { log } from "./utils/log";
import { trendingPoller } from "./services/trending-poller";
import { oracleUpdater } from "./services/oracle-updater";
import { startRotationCron } from "./services/auto-manager";
import { localHypeDetector } from "./services/local-hype-detector";

const app = buildRouter();

app.use("*", honoLogger());
app.use("*", cors({ origin: config.FRONTEND_URL, credentials: true }));

app.onError((err, c) => {
  log.error({ err }, "Unhandled error");
  return c.json({ error: "Internal server error" }, 500);
});

app.notFound((c) => c.json({ error: "Not found" }, 404));

// Boot background services (skip in test/import contexts via NODE_ENV)
if (process.env.NODE_ENV !== "test") {
  trendingPoller.start();
  oracleUpdater.start();
  localHypeDetector.start();
  startRotationCron();
}

log.info(
  { port: config.PORT, env: config.NODE_ENV },
  "Tredie backend starting",
);

export default {
  port: config.PORT,
  fetch: app.fetch,
};
