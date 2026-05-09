import { z } from "zod";
import "dotenv/config";

const envSchema = z.object({
  PORT: z.string().default("4000").transform(Number),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  LOG_LEVEL: z.string().default("info"),

  DATABASE_URL: z.string().url(),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string(),

  SOLANA_RPC_URL: z.string().url(),
  SOLANA_NETWORK: z.enum(["devnet", "mainnet-beta", "localnet"]).default("devnet"),
  TREDIE_PROGRAM_ID: z.string(),
  SIGNER_PRIVATE_KEY: z.string(),
  HELIUS_API_KEY: z.string(),
  HELIUS_WEBHOOK_SECRET: z.string().default(""),

  ELFA_API_KEY: z.string(),
  ELFA_API_SECRET: z.string().default(""),
  ELFA_API_BASE: z.string().url().default("https://api.elfa.ai"),
  ELFA_AUTO_WEBHOOK_SECRET: z.string().default(""),

  // Comma-separated list of allowed CORS origins. Supports dev + prod
  // simultaneously, e.g. "http://localhost:3000,https://tredie.vercel.app".
  // Leading/trailing whitespace per entry is trimmed.
  FRONTEND_URL: z
    .string()
    .default("http://localhost:3000")
    .transform((v) =>
      v
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  BACKEND_URL: z.string().default("http://localhost:4000"),

  AUTO_SPAWN_THRESHOLD_PCT: z.string().default("0.05").transform(Number),
  CA_SPAWN_THRESHOLD: z.string().default("10").transform(Number),
  HYPE_EVENT_PREMIUM_BPS: z.string().default("500").transform(Number),

  GEMINI_API_KEY: z.string().default(""),
  GEMINI_MODEL: z.string().default("gemini-2.5-flash"),
  AI_GATING_ENABLED: z.string().default("true").transform((v) => v === "true"),
  AI_MIN_CONFIDENCE_BPS: z.string().default("4000").transform(Number),

  // Cron expression for the TrendingPoller. Default 2h cadence keeps us
  // well inside the Gemini free-tier 20 RPD budget while still reacting
  // to emerging narratives within a workday. Trends don't move so fast
  // that 15-min granularity is required.
  // Examples:
  //   "0 */2 * * *"  every 2 hours (default, 12 cycles/day)
  //   "0 */1 * * *"  hourly (24/day, paid Gemini tier required)
  //   "0 12 * * *"   daily at noon (1/day, very conservative)
  //   "*/15 * * * *" every 15 min (legacy, will exhaust free tier)
  TRENDING_POLL_CRON: z.string().default("0 */2 * * *"),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error("❌ Invalid environment variables:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = parsed.data;
