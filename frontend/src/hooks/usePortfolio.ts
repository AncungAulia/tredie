import { useQuery } from "@tanstack/react-query";
import { getPortfolio } from "@/lib/api/portfolio";

export function usePortfolio(address: string | null | undefined) {
  return useQuery({
    queryKey: ["portfolio", address],
    queryFn: () => getPortfolio(address!),
    staleTime: 30_000,
    enabled: !!address,
  });
}
