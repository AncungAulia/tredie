import { useQuery } from "@tanstack/react-query";
import { listMarkets, type ListMarketsParams } from "@/lib/api/markets";

export function useMarkets(params: ListMarketsParams = {}) {
  return useQuery({
    queryKey: ["markets", params],
    queryFn: () => listMarkets(params),
    staleTime: 30_000,
  });
}
