"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import SolanaWalletProvider from "./WalletProvider";
import Header from "./layout/Header";
import AuthGate from "./AuthGate";

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      <SolanaWalletProvider>
        <Header />
        <main className="flex flex-col pt-14 min-h-screen">
          <AuthGate>{children}</AuthGate>
        </main>
      </SolanaWalletProvider>
    </QueryClientProvider>
  );
}
