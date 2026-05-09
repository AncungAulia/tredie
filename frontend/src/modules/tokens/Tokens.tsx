"use client";
import { useId, useMemo } from "react";
import { useMarketStore, type TokenCategory } from "@/store/useMarketStore";
import { useMarkets } from "@/hooks/useMarkets";
import { useTrendingTokens } from "@/hooks/useTrending";
import type { Market } from "@/types/api";
import Link from "next/link";
import { TrendingUp, TrendingDown } from "lucide-react";

function MiniLineChart({ data, color = "#9C93E8" }: { data: number[]; color?: string }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const isFlat = max === min;
  const range = max - min || 1;
  const h = 48;
  const w = 160;
  const step = w / (data.length - 1);

  const points = data
    .map((val, i) => {
      const x = i * step;
      const y = isFlat ? h / 2 : h - ((val - min) / range) * h;
      return `${x},${y}`;
    })
    .join(" ");

  const id = useId();
  const gradientId = `grad-tkn-${id.replace(/:/g, "")}`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-12" preserveAspectRatio="none">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${h} ${points} ${w},${h}`} fill={`url(#${gradientId})`} />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function spotPriceSol(market: Market): number {
  const reserves = Number(market.real_sol_reserves) + Number(market.base_virtual_sol);
  const supply = Number(market.virtual_token_supply) - Number(market.tokens_minted);
  if (supply === 0) return 0;
  return reserves / supply;
}

function formatVolume(lamports: string): string {
  const sol = Number(lamports) / 1e9;
  if (sol >= 1_000_000) return `${(sol / 1_000_000).toFixed(1)}M`;
  if (sol >= 1_000) return `${(sol / 1_000).toFixed(1)}K`;
  return sol.toFixed(2);
}

function formatPrice(lamports: number): string {
  const sol = lamports / 1e9;
  if (sol < 0.0001) return sol.toFixed(7);
  if (sol < 0.01) return sol.toFixed(5);
  if (sol < 1) return sol.toFixed(4);
  return sol.toFixed(2);
}

export default function Tokens() {
  const { activeTokenCategory, setTokenCategory } = useMarketStore();

  const { data: allTokenMarkets = [], isLoading: loadingMarkets } = useMarkets({
    type: "token",
    limit: 50,
    sparkline: true,
  });
  const { data: trendingTokens = [], isLoading: loadingTrending } = useTrendingTokens();

  const isLoading = loadingMarkets || loadingTrending;

  const trendingIdentifiers = useMemo(
    () => new Set(trendingTokens.map((t) => t.symbol.toUpperCase())),
    [trendingTokens]
  );

  const filtered = useMemo(() => {
    switch (activeTokenCategory) {
      case "Trending":
        return allTokenMarkets.filter((m) => trendingIdentifiers.has(m.identifier.toUpperCase()));
      case "On X":
        return trendingTokens
          .filter((t) => t.market)
          .map((t) => t.market!)
          .filter(Boolean);
      default:
        return allTokenMarkets;
    }
  }, [allTokenMarkets, activeTokenCategory, trendingIdentifiers, trendingTokens]);

  const categories: TokenCategory[] = ["All", "Trending", "On X"];

  return (
    <div className="w-full h-full flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-display font-bold">Tokens</h1>
      </div>

      <div className="flex items-center gap-3 overflow-x-auto scrollbar-hide pb-1">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setTokenCategory(cat)}
            className={`px-5 py-2.5 rounded-full text-sm font-medium transition-all duration-200 whitespace-nowrap ${
              activeTokenCategory === cat
                ? "bg-[rgba(156,147,232,0.15)] text-[#9C93E8] border border-[rgba(156,147,232,0.30)]"
                : "bg-white/[0.04] text-white/50 hover:text-white hover:bg-white/[0.06] border border-white/[0.07]"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-6 h-52 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filtered.map((market) => {
            const mindshare = market.current_mindshare_bps / 100;
            const price = spotPriceSol(market);
            const ratchet = market.ratchet_multiplier_bps / 10_000;
            const rawSparkline = (market.market_cap_sparkline_24h ?? []).map(Number);
            const currentMcap = price * Number(market.tokens_minted);
            const sparkline =
              rawSparkline.length >= 2
                ? rawSparkline
                : Array(2).fill(currentMcap);
            const sparklineDelta =
              rawSparkline.length >= 2 && rawSparkline[0] !== 0
                ? ((rawSparkline[rawSparkline.length - 1] - rawSparkline[0]) / rawSparkline[0]) * 100
                : 0;

            return (
              <Link href={`/tokens/${encodeURIComponent(market.identifier)}`} key={market.identifier}>
                <div className="group bg-white/[0.03] border border-white/[0.07] hover:border-[rgba(156,147,232,0.30)] hover:bg-[rgba(156,147,232,0.04)] transition-all duration-200 rounded-2xl p-6 cursor-pointer flex flex-col gap-5">
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-white font-sans font-bold text-lg leading-snug truncate group-hover:text-[#B3ABF0] transition-colors">
                        {market.display_name ?? market.identifier}
                      </h3>
                      <p className="text-white/30 text-xs font-mono mt-1.5">{market.identifier}</p>
                    </div>
                    <div className="flex flex-col items-end shrink-0">
                      <span className="text-[10px] text-white/30 uppercase tracking-wider">Attention</span>
                      <span className="text-xl font-mono font-bold">{mindshare.toFixed(1)}%</span>
                      <span className={`text-xs flex items-center gap-1 mt-0.5 ${sparklineDelta >= 0 ? "text-[#22C55E]" : "text-[#EF4444]"}`}>
                        {sparklineDelta >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                        {Math.abs(sparklineDelta).toFixed(1)}%
                      </span>
                    </div>
                  </div>

                  <div className="flex items-baseline gap-2">
                    <span className="text-white text-2xl font-mono font-bold">{formatPrice(price)}</span>
                    <span className="text-white/30 text-sm font-mono">SOL</span>
                  </div>

                  <MiniLineChart data={sparkline} />

                  <div className="flex items-center justify-between pt-4 border-t border-white/[0.05]">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-white/30 uppercase tracking-wider">Vol</span>
                      <span className="text-xs font-mono text-white/70">
                        {formatVolume(market.volume_24h_lamports)} SOL
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-white/30 uppercase tracking-wider">Holders</span>
                      <span className="text-xs font-mono text-white/70">{Number(market.holders_count).toLocaleString()}</span>
                    </div>
                    <div className="bg-[rgba(156,147,232,0.12)] text-[#9C93E8] px-2.5 py-1 rounded-md text-[11px] font-mono font-bold">
                      {ratchet.toFixed(1)}x
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {!isLoading && filtered.length === 0 && (
        <div className="w-full py-24 flex flex-col items-center justify-center text-white/30">
          <p className="text-base">No tokens found for this category.</p>
        </div>
      )}
    </div>
  );
}
