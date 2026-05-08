"use client";
import { useState, useCallback } from "react";
import { useWallets, useSignAndSendTransaction } from "@privy-io/react-auth/solana";
import { prepareTrade } from "@/lib/api/trade";

export type TradeStatus = "idle" | "preparing" | "signing" | "success" | "error";

export function useTradeAction() {
  const [status, setStatus] = useState<TradeStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const { wallets } = useWallets();
  const { signAndSendTransaction } = useSignAndSendTransaction();

  const wallet = wallets[0] ?? null;

  const execute = useCallback(
    async (params: {
      identifier: string;
      side: "buy" | "sell";
      solAmount?: number;
      tokenAmount?: string;
      slippageBps?: number;
    }): Promise<boolean> => {
      if (!wallet) {
        setError("No Solana wallet connected");
        setStatus("error");
        return false;
      }

      setStatus("preparing");
      setError(null);

      try {
        const { transaction: base64Tx } = await prepareTrade({
          ...params,
          trader: wallet.address,
        });

        const txBytes = Uint8Array.from(atob(base64Tx), (c) => c.charCodeAt(0));

        setStatus("signing");

        await signAndSendTransaction({ transaction: txBytes, wallet });

        setStatus("success");
        return true;
      } catch (e: any) {
        const msg: string = e?.message ?? "Trade failed";
        // SlippageExceeded = on-chain AMM protection hit
        setError(
          msg.includes("SlippageExceeded")
            ? "Price moved too fast. Increase slippage or try again."
            : msg,
        );
        setStatus("error");
        return false;
      }
    },
    [wallet, signAndSendTransaction],
  );

  const reset = useCallback(() => {
    setStatus("idle");
    setError(null);
  }, []);

  return {
    execute,
    status,
    error,
    reset,
    walletAddress: wallet?.address ?? null,
  };
}
