"use client";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

/**
 * Subscribes to Supabase Realtime for a specific market.
 * On new trade or market update → invalidates React Query cache
 * so useMarketDetail refetches automatically.
 */
export function useMarketRealtime(identifier: string, marketPda: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!marketPda) return;

    const channel = supabase
      .channel(`market-${marketPda}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "trades",
          filter: `market_pda=eq.${marketPda}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["market", identifier] });
          queryClient.invalidateQueries({ queryKey: ["ohlc", identifier] });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "markets",
          filter: `pda=eq.${marketPda}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["market", identifier] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [marketPda, identifier, queryClient]);
}
