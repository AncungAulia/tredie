import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger as honoLogger } from "hono/logger";
import { buildRouter } from "./api/routes";
import { config } from "./config";
import { log } from "./utils/log";
import { trendingPoller } from "./services/trending-poller";
import { oracleUpdater } from "./services/oracle-updater";
import { startRotationCron } from "./services/auto-manager";
import { localHypeDetector } from "./services/local-hype-detector";

// Middleware HARUS didaftarkan sebelum route di-mount. Hono menjalankan
// handler sesuai urutan registrasi, jadi `app.use()` setelah `app.route()`
// tidak pernah jalan untuk route yang match — hanya untuk 404 fallthrough.
const app = new Hono();

app.use("*", honoLogger());
app.use("*", cors({ origin: config.FRONTEND_URL, credentials: true }));

app.route("/", buildRouter());

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
  // Default idleTimeout Bun 10 detik, sementara operasi admin sah-sah saja
  // berjalan lama: update-oracles menyentuh seluruh market on-chain (~36s) dan
  // poll-trending menembak beberapa endpoint Elfa berurutan (~16s). Lewat batas
  // itu Bun menutup soket, cloudflared melaporkan EOF, dan pemanggil menerima
  // 502 padahal handler-nya menyelesaikan pekerjaan dan mencatat 200.
  idleTimeout: 120,
  fetch: app.fetch,
};
