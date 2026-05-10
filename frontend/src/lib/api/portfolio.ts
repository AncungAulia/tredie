import { apiClient } from "./client";
import type { Portfolio } from "@/types/api";

export async function getPortfolio(address: string, limit = 200): Promise<Portfolio> {
  return apiClient
    .get(`portfolio/${address}`, { searchParams: { limit: String(limit) } })
    .json<Portfolio>();
}
