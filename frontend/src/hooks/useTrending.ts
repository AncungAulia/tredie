import { useQuery } from "@tanstack/react-query";
import { getTrendingTokens, getTrendingCAs } from "@/lib/api/trending";

export function useTrendingTokens() {
  return useQuery({
    queryKey: ["trending", "tokens"],
    queryFn: getTrendingTokens,
    staleTime: 60_000,
    refetchInterval: 120_000,
  });
}

export function useTrendingCAs(platform: "twitter" | "telegram") {
  return useQuery({
    queryKey: ["trending", "cas", platform],
    queryFn: () => getTrendingCAs(platform),
    staleTime: 60_000,
    refetchInterval: 120_000,
  });
}
