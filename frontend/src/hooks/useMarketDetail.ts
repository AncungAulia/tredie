import { useQuery } from "@tanstack/react-query";
import { getMarketDetail } from "@/lib/api/markets";

export function useMarketDetail(identifier: string) {
  return useQuery({
    queryKey: ["market", identifier],
    queryFn: () => getMarketDetail(identifier),
    staleTime: 8_000,
    refetchInterval: 10_000,
    enabled: !!identifier,
  });
}
