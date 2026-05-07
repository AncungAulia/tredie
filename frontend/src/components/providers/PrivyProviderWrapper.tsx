"use client";
import { PrivyProvider } from "@privy-io/react-auth";
import { toSolanaWalletConnectors } from "@privy-io/react-auth/solana";
import { createSolanaRpc, createSolanaRpcSubscriptions } from "@solana/kit";

const solanaConnectors = toSolanaWalletConnectors({ shouldAutoConnect: false });

const heliusRpcUrl = process.env.NEXT_PUBLIC_HELIUS_RPC_URL!;
// Helius WebSocket: ganti https:// → wss://
const heliusWsUrl = heliusRpcUrl.replace("https://", "wss://");

export default function PrivyProviderWrapper({ children }: { children: React.ReactNode }) {
  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID!}
      config={{
        loginMethods: ["wallet", "email"],
        appearance: {
          theme: "dark",
          accentColor: "#9C93E8",
          walletChainType: "solana-only",
          logo: "/logo.png",
        },
        solana: {
          rpcs: {
            "solana:devnet": {
              rpc: createSolanaRpc(heliusRpcUrl),
              rpcSubscriptions: createSolanaRpcSubscriptions(heliusWsUrl),
              blockExplorerUrl: "https://explorer.solana.com/?cluster=devnet",
            },
          },
        },
        externalWallets: {
          solana: {
            connectors: solanaConnectors,
          },
        },
        embeddedWallets: {
          solana: {
            createOnLogin: "users-without-wallets",
          },
        },
      }}
    >
      {children}
    </PrivyProvider>
  );
}
