import { Hono } from "hono";
import { healthRoutes } from "./health";
import { marketsRoutes } from "./markets";
import { trendingRoutes } from "./trending";
import { searchRoutes } from "./search";
import { resolveLinkRoutes } from "./resolve-link";
import { webhookRoutes } from "./webhooks";
import { factoryRoutes } from "./factory";
import { autoQueriesRoutes } from "./auto-queries";
import { adminRoutes } from "./admin";
import { swaggerUI } from "@hono/swagger-ui";
import { openApiSpec } from "./openapi";

export function buildRouter() {
  const app = new Hono();
  const v1 = new Hono();

  v1.route("/health", healthRoutes);
  v1.route("/markets", marketsRoutes);
  v1.route("/trending", trendingRoutes);
  v1.route("/search", searchRoutes);
  v1.route("/resolve-link", resolveLinkRoutes);
  v1.route("/factory", factoryRoutes);
  v1.route("/auto-queries", autoQueriesRoutes);
  v1.route("/admin", adminRoutes);

  app.route("/api/v1", v1);
  app.route("/api/webhooks", webhookRoutes);

  // OpenAPI spec + Swagger UI — interactive API browser
  app.get("/api/openapi.json", (c) => c.json(openApiSpec));
  app.get("/api/docs", swaggerUI({ url: "/api/openapi.json" }));

  return app;
}
