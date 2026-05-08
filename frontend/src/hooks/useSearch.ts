import { useQuery } from "@tanstack/react-query";
import { searchMarkets } from "@/lib/api/search";

export function useSearch(query: string) {
  return useQuery({
    queryKey: ["search", query],
    queryFn: () => searchMarkets(query),
    staleTime: 10_000,
    enabled: query.trim().length >= 2,
  });
}
