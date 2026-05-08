import { useQuery } from "@tanstack/react-query";
import { getMarketOHLC } from "@/lib/api/markets";
import type { OHLCInterval } from "@/types/api";

export function useOHLC(identifier: string, interval: OHLCInterval = "1h") {
  return useQuery({
    queryKey: ["ohlc", identifier, interval],
    queryFn: () => getMarketOHLC(identifier, interval),
    staleTime: 25_000,
    refetchInterval: 30_000,
    enabled: !!identifier,
  });
}
