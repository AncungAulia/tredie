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

  FRONTEND_URL: z.string().default("http://localhost:3000"),
  BACKEND_URL: z.string().default("http://localhost:4000"),

  AUTO_SPAWN_THRESHOLD_PCT: z.string().default("0.05").transform(Number),
  CA_SPAWN_THRESHOLD: z.string().default("10").transform(Number),
  HYPE_EVENT_PREMIUM_BPS: z.string().default("500").transform(Number),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error("❌ Invalid environment variables:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = parsed.data;
