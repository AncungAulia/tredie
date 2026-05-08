import { apiClient } from "./client";
import type { TrendingToken, TrendingCA } from "@/types/api";

export async function getTrendingTokens(): Promise<TrendingToken[]> {
  const res = await apiClient.get("trending/tokens").json<{ tokens: TrendingToken[] }>();
  return res.tokens;
}

export async function getTrendingCAs(platform: "twitter" | "telegram"): Promise<TrendingCA[]> {
  const res = await apiClient.get(`trending/cas/${platform}`).json<{ cas: TrendingCA[] }>();
  return res.cas;
}
