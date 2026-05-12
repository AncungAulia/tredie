import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { listMarkets, type ListMarketsParams } from "@/lib/api/markets";

export function useMarkets(params: ListMarketsParams = {}) {
  return useQuery({
    queryKey: ["markets", params],
    queryFn: () => listMarkets(params),
    staleTime: 30_000,
  });
}

const PAGE_SIZE = 20;

export function useInfiniteMarkets(params: Omit<ListMarketsParams, "limit" | "offset"> = {}) {
  return useInfiniteQuery({
    queryKey: ["markets-infinite", params],
    queryFn: ({ pageParam }) => listMarkets({ ...params, limit: PAGE_SIZE, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((sum, p) => sum + p.markets.length, 0);
      return loaded < lastPage.total ? loaded : undefined;
    },
    staleTime: 30_000,
  });
}
