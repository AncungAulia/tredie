import { apiClient } from "./client";
import type { SearchResult, ResolveLinkResponse } from "@/types/api";

export async function searchMarkets(q: string): Promise<SearchResult[]> {
  if (!q.trim()) return [];
  const res = await apiClient
    .get("search", { searchParams: { q } })
    .json<{ suggestions: SearchResult[] }>();
  return res.suggestions;
}

export async function resolveLink(url: string): Promise<ResolveLinkResponse> {
  return apiClient.post("resolve-link", { json: { url } }).json<ResolveLinkResponse>();
}
