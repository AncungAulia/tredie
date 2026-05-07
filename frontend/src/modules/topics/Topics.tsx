"use client";
import React, { useId } from "react";
import { useMarketStore } from "@/store/useMarketStore";
import { MarketCategory } from "@/lib/mock-data/markets";
import Link from "next/link";
import { TrendingUp, TrendingDown } from "lucide-react";

function MiniLineChart({ data, color = "#9C93E8" }: { data: number[]; color?: string }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const h = 48;
  const w = 160;
  const step = w / (data.length - 1);

  const points = data.map((val, i) => {
    const x = i * step;
    const y = h - ((val - min) / range) * h;
    return `${x},${y}`;
  }).join(" ");

  const id = useId();
  const gradientId = `grad-${id.replace(/:/g, "")}`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-12" preserveAspectRatio="none">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon
        points={`0,${h} ${points} ${w},${h}`}
        fill={`url(#${gradientId})`}
      />
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

export default function Topics() {
  const { activeCategory, setCategory, getFilteredMarkets } = useMarketStore();
  const markets = getFilteredMarkets();

  const categories: MarketCategory[] = ["All", "People", "Brands", "Events", "Crypto"];

  return (
    <div className="w-full h-full flex flex-col gap-8">
      {/* Page title */}
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-display font-bold">Discover Topics</h1>
        <p className="text-white/40 text-sm">Trending attention markets curated by Elfa AI</p>
      </div>

      {/* Category filter */}
      <div className="flex items-center gap-3 overflow-x-auto scrollbar-hide pb-1">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={`px-5 py-2.5 rounded-full text-sm font-medium transition-all duration-200 whitespace-nowrap ${
              activeCategory === cat
                ? "bg-[rgba(156,147,232,0.15)] text-[#9C93E8] border border-[rgba(156,147,232,0.30)]"
                : "bg-white/[0.04] text-white/50 hover:text-white hover:bg-white/[0.06] border border-white/[0.07]"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Market cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {markets.map((market) => (
          <Link href={`/tokens/${market.id}`} key={market.id}>
            <div className="group bg-white/[0.03] border border-white/[0.07] hover:border-[rgba(156,147,232,0.30)] hover:bg-[rgba(156,147,232,0.04)] transition-all duration-200 rounded-2xl p-6 cursor-pointer flex flex-col gap-5">
              {/* Top row: name + mindshare */}
              <div className="flex justify-between items-start gap-4">
                <div className="flex-1 min-w-0">
                  <h3 className="text-white font-sans font-bold text-lg leading-snug truncate group-hover:text-[#B3ABF0] transition-colors">
                    {market.name}
                  </h3>
                  <p className="text-white/30 text-xs font-mono mt-1.5">{market.ticker}</p>
                </div>
                <div className="flex flex-col items-end shrink-0">
                  <span className="text-lg font-mono font-bold">{market.mindshare}%</span>
                  <span className={`text-xs flex items-center gap-1 mt-0.5 ${market.mindshareDelta >= 0 ? "text-[#22C55E]" : "text-[#EF4444]"}`}>
                    {market.mindshareDelta >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                    {Math.abs(market.mindshareDelta)}%
                  </span>
                </div>
              </div>

              {/* Line chart */}
              <MiniLineChart data={market.sparkline} />

              {/* Bottom row: vol + ratchet */}
              <div className="flex items-center justify-between pt-4 border-t border-white/[0.05]">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-white/30 uppercase tracking-wider">Vol</span>
                  <span className="text-xs font-mono text-white/70">${(market.volume24h / 1000).toFixed(1)}k</span>
                </div>
                <div className="bg-[rgba(156,147,232,0.12)] text-[#9C93E8] px-2.5 py-1 rounded-md text-[11px] font-mono font-bold">
                  {market.ratchetMultiplier.toFixed(1)}x
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {markets.length === 0 && (
        <div className="w-full py-24 flex flex-col items-center justify-center text-white/30">
          <p className="text-base">No markets found for this category.</p>
        </div>
      )}
    </div>
  );
}
