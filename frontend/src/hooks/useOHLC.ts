import { useQuery } from "@tanstack/react-query";
import { getMarketOHLC } from "@/lib/api/markets";
import type { OHLCInterval } from "@/types/api";

export function useOHLC(identifier: string, interval: OHLCInterval = "1h", limit = 200) {
  return useQuery({
    queryKey: ["ohlc", identifier, interval, limit],
    queryFn: () => getMarketOHLC(identifier, interval, limit),
    staleTime: 8_000,
    refetchInterval: 10_000,
    enabled: !!identifier,
  });
}
