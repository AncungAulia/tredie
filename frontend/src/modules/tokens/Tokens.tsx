"use client";
import React, { useState, useId } from "react";
import { TokenCategory, mockTokenMarkets } from "@/lib/mock-data/tokens";
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
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function formatPrice(price: number): string {
  if (price < 0.0001) return price.toFixed(7);
  if (price < 0.01) return price.toFixed(5);
  if (price < 1) return price.toFixed(4);
  return price.toFixed(2);
}

export default function Tokens() {
  const [activeCategory, setActiveCategory] = useState<TokenCategory>("All");

  const categories: TokenCategory[] = ["All", "Trending", "On X", "On TG"];

  const filtered = mockTokenMarkets.filter(
    (t) => activeCategory === "All" || t.category === activeCategory
  );

  return (
    <div className="w-full h-full flex flex-col gap-8">
      {/* Page title */}
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-display font-bold">Tokens</h1>
        <p className="text-white/40 text-sm">Attention markets for crypto tokens — powered by Elfa AI</p>
      </div>

      {/* Category filter */}
      <div className="flex items-center gap-3 overflow-x-auto scrollbar-hide pb-1">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
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

      {/* Token cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {filtered.map((token) => (
          <Link href={`/tokens/${token.id}`} key={token.id}>
            <div className="group bg-white/[0.03] border border-white/[0.07] hover:border-[rgba(156,147,232,0.30)] hover:bg-[rgba(156,147,232,0.04)] transition-all duration-200 rounded-2xl p-6 cursor-pointer flex flex-col gap-5">
              {/* Top row */}
              <div className="flex justify-between items-start gap-4">
                <div className="flex-1 min-w-0">
                  <h3 className="text-white font-sans font-bold text-lg leading-snug truncate group-hover:text-[#B3ABF0] transition-colors">
                    {token.name}
                  </h3>
                  <p className="text-white/30 text-xs font-mono mt-1.5">{token.ticker}</p>
                </div>
                <div className="flex flex-col items-end shrink-0">
                  <span className="text-[10px] text-white/30 uppercase tracking-wider">Attention</span>
                  <span className="text-lg font-mono font-bold">{token.attentionScore}%</span>
                  <span className={`text-xs flex items-center gap-1 mt-0.5 ${token.attentionDelta >= 0 ? "text-[#22C55E]" : "text-[#EF4444]"}`}>
                    {token.attentionDelta >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                    {Math.abs(token.attentionDelta)}%
                  </span>
                </div>
              </div>

              {/* Price row */}
              <div className="flex items-baseline gap-2">
                <span className="text-white/30 text-sm font-mono">$</span>
                <span className="text-white text-2xl font-mono font-bold">{formatPrice(token.price)}</span>
                <span className={`text-xs font-mono ${token.priceDelta >= 0 ? "text-[#22C55E]" : "text-[#EF4444]"}`}>
                  {token.priceDelta >= 0 ? "+" : ""}{token.priceDelta.toFixed(1)}%
                </span>
              </div>

              {/* Line chart */}
              <MiniLineChart data={token.sparkline} />

              {/* Bottom stats */}
              <div className="flex items-center justify-between pt-4 border-t border-white/[0.05]">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-white/30 uppercase tracking-wider">Vol</span>
                  <span className="text-xs font-mono text-white/70">
                    ${token.volume24h >= 1_000_000 ? `${(token.volume24h / 1_000_000).toFixed(1)}M` : `${(token.volume24h / 1_000).toFixed(0)}K`}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-white/30 uppercase tracking-wider">Holders</span>
                  <span className="text-xs font-mono text-white/70">{token.holders.toLocaleString()}</span>
                </div>
                <div className="bg-[rgba(156,147,232,0.12)] text-[#9C93E8] px-2.5 py-1 rounded-md text-[11px] font-mono font-bold">
                  {token.ratchetMultiplier.toFixed(1)}x
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="w-full py-24 flex flex-col items-center justify-center text-white/30">
          <p className="text-base">No tokens found for this category.</p>
        </div>
      )}
    </div>
  );
}
