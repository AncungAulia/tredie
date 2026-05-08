"use client";
import { useQuery } from "@tanstack/react-query";

const RPC_URL = process.env.NEXT_PUBLIC_HELIUS_RPC_URL ?? "https://api.devnet.solana.com";

async function rpc(method: string, params: unknown[]) {
  const res = await fetch(RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  return json.result;
}

export function useWalletBalance(address: string | undefined, mintAddress: string | undefined) {
  const solQuery = useQuery({
    queryKey: ["balance", "sol", address],
    queryFn: async () => {
      const result = await rpc("getBalance", [address!]);
      return result.value as number; // lamports
    },
    enabled: !!address,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  const tokenQuery = useQuery({
    queryKey: ["balance", "token", address, mintAddress],
    queryFn: async () => {
      const result = await rpc("getTokenAccountsByOwner", [
        address!,
        { mint: mintAddress! },
        { encoding: "jsonParsed" },
      ]);
      const accounts = result.value as any[];
      if (!accounts.length) return "0";
      return accounts[0].account.data.parsed.info.tokenAmount.amount as string;
    },
    enabled: !!address && !!mintAddress,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  return {
    solBalance: solQuery.data ?? 0,
    tokenBalance: tokenQuery.data ?? "0",
    refetchBalances: () => {
      solQuery.refetch();
      tokenQuery.refetch();
    },
  };
}
