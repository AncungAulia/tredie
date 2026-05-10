import { apiClient } from "./client";
import type { Market, MarketDetail, OHLCResponse, OHLCInterval } from "@/types/api";

export type MarketType = "token" | "topic";
export type MarketSortBy = "mindshare" | "volume" | "created_at";
export type SortOrder = "asc" | "desc";

export interface ListMarketsParams {
  type?: MarketType;
  assetClass?: number;
  limit?: number;
  sortBy?: MarketSortBy;
  order?: SortOrder;
  sparkline?: boolean;
}

export interface MarketsResponse {
  markets: Market[];
  total: number;
  solPriceUsd: number;
}

export async function listMarkets(params: ListMarketsParams = {}): Promise<MarketsResponse> {
  const searchParams: Record<string, string> = {};
  if (params.type) searchParams.type = params.type;
  if (params.assetClass !== undefined) searchParams.assetClass = String(params.assetClass);
  if (params.limit !== undefined) searchParams.limit = String(params.limit);
  if (params.sortBy) searchParams.sortBy = params.sortBy;
  if (params.order) searchParams.order = params.order;
  searchParams.sparkline = String(params.sparkline ?? true);

  const res = await apiClient.get("markets", { searchParams }).json<{ markets: Market[]; total: number; sol_price_usd: number }>();
  return { markets: res.markets, total: res.total, solPriceUsd: res.sol_price_usd ?? 0 };
}

export async function getMarketDetail(identifier: string): Promise<MarketDetail> {
  const res = await apiClient
    .get(`markets/${encodeURIComponent(identifier)}`)
    .json<{
      market: Market;
      mindshareHistory: MarketDetail["mindshare_history"];
      recentTrades: MarketDetail["recent_trades"];
      holders: MarketDetail["holders"];
      stats: MarketDetail["stats"];
    }>();
  return {
    ...res.market,
    mindshare_history: res.mindshareHistory,
    recent_trades: res.recentTrades,
    holders: res.holders ?? [],
    stats: res.stats,
  };
}

export async function getMarketOHLC(
  identifier: string,
  interval: OHLCInterval = "1h",
  limit = 100
): Promise<OHLCResponse> {
  return apiClient
    .get(`markets/${encodeURIComponent(identifier)}/ohlc`, {
      searchParams: { interval, limit: String(limit) },
    })
    .json<OHLCResponse>();
}
