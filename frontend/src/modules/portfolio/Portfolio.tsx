"use client";
import { useState } from "react";
import Link from "next/link";
import { usePrivy } from "@privy-io/react-auth";
import { useWallets as useSolanaWallets } from "@privy-io/react-auth/solana";
import { usePortfolio } from "@/hooks/usePortfolio";
import { Search } from "lucide-react";

function lamportsToSol(lamports: string | number): number {
  return Number(lamports) / 1e9;
}

function formatSol(lamports: string | number): string {
  return lamportsToSol(lamports).toFixed(4);
}

function pnlColor(lamports: string): string {
  return Number(lamports) >= 0 ? "text-[#22C55E]" : "text-[#EF4444]";
}

export default function Portfolio() {
  const { ready: privyReady, authenticated, user } = usePrivy();
  const { wallets: solanaWallets } = useSolanaWallets();
  const [activeTab, setActiveTab] = useState<"positions" | "activity">("positions");
  const [search, setSearch] = useState("");

  // Prioritaskan wallet aktif, fallback ke linked account (untuk sesi tanpa auto-connect)
  const linkedSolanaAddress = (user?.linkedAccounts as any[])
    ?.find(a => a.type === "wallet" && a.chainType === "solana")
    ?.address as string | undefined;
  const address = solanaWallets[0]?.address ?? linkedSolanaAddress;

  const { data, isLoading, isError } = usePortfolio(address);

  const stats = data?.stats;
  const positions = (data?.positions ?? []).filter((p) =>
    search ? p.identifier.toLowerCase().includes(search.toLowerCase()) ||
      (p.display_name ?? "").toLowerCase().includes(search.toLowerCase()) : true
  );
  const activity = data?.activity ?? [];

  if (!privyReady || !authenticated || !address) {
    return (
      <div className="w-full max-w-5xl mx-auto flex flex-col gap-10">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-display font-bold">Portfolio</h1>
        </div>
        <div className="w-full py-32 flex flex-col items-center justify-center gap-3 border border-white/[0.05] rounded-2xl bg-white/[0.02]">
          <p className="text-white/40 text-sm">Connect your wallet to view your portfolio</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col gap-10">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-display font-bold">Portfolio</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1 bg-white/[0.03] border border-white/[0.07] rounded-2xl p-8 flex flex-col justify-center">
          <p className="text-white/40 text-sm mb-2">Portfolio Value</p>
          {isLoading ? (
            <div className="h-10 w-32 bg-white/10 rounded animate-shimmer" />
          ) : (
            <h2 className="text-4xl font-sans font-bold flex items-baseline gap-2">
              {formatSol(stats?.total_held_value_lamports ?? 0)}
              <span className="text-base font-mono text-white/30">SOL</span>
            </h2>
          )}
        </div>

        <div className="md:col-span-2 bg-white/[0.03] border border-white/[0.07] rounded-2xl p-8 grid grid-cols-2 sm:grid-cols-5 gap-6">
          {[
            {
              label: "Realized PnL",
              value: isLoading ? "—" : `${formatSol(stats?.realized_pnl_lamports ?? 0)}`,
              unit: "SOL",
              colored: !isLoading && stats ? stats.realized_pnl_lamports : null,
            },
            {
              label: "Volume",
              value: isLoading ? "—" : `${formatSol(stats?.total_volume_lamports ?? 0)}`,
              unit: "SOL",
            },
            {
              label: "Avg Profit/Trade",
              value: isLoading ? "—" : `${(lamportsToSol(stats?.avg_profit_per_trade_lamports ?? 0)).toFixed(4)}`,
              unit: "SOL",
            },
            { label: "Trades", value: isLoading ? "—" : String(stats?.total_trades ?? 0) },
          ].map(({ label, value, unit, colored }) => (
            <div key={label} className="flex flex-col gap-1.5">
              <span className="text-white/40 text-xs">{label}</span>
              <span className={`font-mono text-sm ${colored !== null && colored !== undefined ? pnlColor(colored) : ""}`}>
                {value}
                {unit && value !== "—" && <span className="text-white/30 text-xs ml-1">{unit}</span>}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-8 border-b border-white/[0.07]">
          {(["positions", "activity"] as const).map((tab) => (
            <button
              key={tab}
              className={`pb-4 text-sm font-medium relative transition-colors capitalize ${activeTab === tab ? "text-white" : "text-white/40 hover:text-white/70"}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
              {activeTab === tab && (
                <div className="absolute bottom-0 left-0 w-full h-[2px] bg-[#9C93E8] rounded-full" />
              )}
            </button>
          ))}
        </div>

        {activeTab === "positions" && (
          <>
            <div className="relative w-full max-w-xs">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-white/30" />
              </div>
              <input
                type="text"
                placeholder="Search positions..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="block w-full pl-10 pr-4 py-2.5 border border-white/[0.07] rounded-xl bg-white/[0.02] text-sm placeholder-white/30 text-white focus:outline-none focus:bg-white/[0.04] focus:border-[rgba(156,147,232,0.30)] transition-colors"
              />
            </div>

            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-16 bg-white/[0.03] border border-white/[0.05] rounded-xl animate-shimmer" />
                ))}
              </div>
            ) : isError ? (
              <div className="py-16 text-center text-white/30 text-sm">Failed to load positions.</div>
            ) : positions.length === 0 ? (
              <div className="w-full border border-white/[0.05] rounded-2xl bg-white/[0.02] min-h-[320px] flex flex-col items-center justify-center gap-3">
                <p className="text-white/40 text-sm">No positions yet.</p>
                <p className="text-white/20 text-xs">Start trading to see your positions here.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {positions.map((pos) => (
                  <Link
                    key={pos.market_pda}
                    href={`/tokens/${encodeURIComponent(pos.identifier)}`}
                    className="block bg-white/[0.03] border border-white/[0.06] rounded-xl px-5 py-4 hover:bg-white/[0.06] hover:border-white/[0.12] transition-colors cursor-pointer"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex flex-col gap-0.5">
                        <span className="text-white font-medium text-sm truncate">
                          {pos.display_name ?? pos.identifier}
                        </span>
                        <span className="text-white/30 text-xs font-mono truncate">{pos.identifier}</span>
                      </div>
                      <div className="flex items-center gap-4 sm:gap-8 text-right flex-shrink-0">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-white/30 text-[11px]">Held value</span>
                          <span className="font-mono text-sm">{formatSol(pos.held_value_lamports)} <span className="text-white/30 text-[10px]">SOL</span></span>
                        </div>
                        <div className="hidden sm:flex flex-col gap-0.5">
                          <span className="text-white/30 text-[11px]">Unrealized PnL</span>
                          <span className={`font-mono text-sm ${pnlColor(pos.unrealized_pnl_lamports)}`}>
                            {Number(pos.unrealized_pnl_lamports) >= 0 ? "+" : ""}{formatSol(pos.unrealized_pnl_lamports)}
                          </span>
                        </div>
                        <div className="hidden sm:flex flex-col gap-0.5">
                          <span className="text-white/30 text-[11px]">Realized PnL</span>
                          <span className={`font-mono text-sm ${pnlColor(pos.realized_pnl_lamports)}`}>
                            {Number(pos.realized_pnl_lamports) >= 0 ? "+" : ""}{formatSol(pos.realized_pnl_lamports)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="sm:hidden mt-3 pt-3 border-t border-white/[0.05] flex items-center gap-6">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-white/30 text-[11px]">Unrealized PnL</span>
                        <span className={`font-mono text-xs ${pnlColor(pos.unrealized_pnl_lamports)}`}>
                          {Number(pos.unrealized_pnl_lamports) >= 0 ? "+" : ""}{formatSol(pos.unrealized_pnl_lamports)}
                        </span>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-white/30 text-[11px]">Realized PnL</span>
                        <span className={`font-mono text-xs ${pnlColor(pos.realized_pnl_lamports)}`}>
                          {Number(pos.realized_pnl_lamports) >= 0 ? "+" : ""}{formatSol(pos.realized_pnl_lamports)}
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </>
        )}

        {activeTab === "activity" && (
          isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-14 bg-white/[0.03] border border-white/[0.05] rounded-xl animate-shimmer" />
              ))}
            </div>
          ) : activity.length === 0 ? (
            <div className="w-full border border-white/[0.05] rounded-2xl bg-white/[0.02] min-h-[320px] flex flex-col items-center justify-center gap-3">
              <p className="text-white/40 text-sm">No activity yet.</p>
              <p className="text-white/20 text-xs">Your trade history will appear here.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {activity.map((tx) => {
                const date = new Date(Number(tx.block_time) * 1000);
                return (
                  <div
                    key={tx.signature}
                    className="flex items-center gap-3 bg-white/[0.03] border border-white/[0.06] rounded-xl px-5 py-3"
                  >
                    <span className={`text-xs font-bold px-2 py-0.5 rounded flex-shrink-0 ${tx.side === 0 ? "bg-[#22C55E]/10 text-[#22C55E]" : "bg-[#EF4444]/10 text-[#EF4444]"}`}>
                      {tx.side === 0 ? "BUY" : "SELL"}
                    </span>
                    <span className="text-white text-sm min-w-0 flex-1 truncate">{tx.display_name ?? tx.identifier}</span>
                    <div className="flex flex-col items-end flex-shrink-0 gap-0.5">
                      <span className="font-mono text-sm">{formatSol(tx.sol_amount)}</span>
                      <span className="text-white/30 text-xs font-mono">
                        {date.toLocaleDateString()} {date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}
      </div>
    </div>
  );
}
