"use client";
import { useId } from "react";
import { useMarkets } from "@/hooks/useMarkets";
import type { Market } from "@/types/api";
import Link from "next/link";
import { TrendingUp, TrendingDown } from "lucide-react";

function MiniLineChart({
  data,
  color = "#9C93E8",
}: {
  data: number[];
  color?: string;
}) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const h = 48;
  const w = 160;
  const step = w / (data.length - 1);

  const points = data
    .map((val, i) => {
      const x = i * step;
      const y = h - ((val - min) / range) * h;
      return `${x},${y}`;
    })
    .join(" ");

  const id = useId();
  const gradientId = `grad-${id.replace(/:/g, "")}`;

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="w-full h-12"
      preserveAspectRatio="none"
    >
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

function formatVolume(lamports: string): string {
  const sol = Number(lamports) / 1e9;
  if (sol >= 1_000_000) return `${(sol / 1_000_000).toFixed(1)}M`;
  if (sol >= 1_000) return `${(sol / 1_000).toFixed(1)}K`;
  return sol.toFixed(2);
}

function TrendCard({ market }: { market: Market }) {
  const mindshare = market.current_mindshare_bps / 100;
  const sparkline = market.sparkline_24h;
  const sparklineDelta =
    sparkline.length >= 2 ? sparkline[sparkline.length - 1] - sparkline[0] : 0;
  const ratchet = market.ratchet_multiplier_bps / 10_000;

  return (
    <Link href={`/trends/${encodeURIComponent(market.identifier)}`}>
      <div className="group bg-white/[0.03] border border-white/[0.07] hover:border-[rgba(156,147,232,0.30)] hover:bg-[rgba(156,147,232,0.04)] transition-all duration-200 rounded-2xl p-6 cursor-pointer flex flex-col gap-5">
        <div className="flex justify-between items-start gap-4">
          <div className="flex-1 min-w-0">
            <h3 className="text-white font-sans font-bold text-lg leading-snug truncate group-hover:text-[#B3ABF0] transition-colors">
              {market.display_name ?? market.identifier}
            </h3>
            <p className="text-white/30 text-xs font-mono mt-1.5">
              {market.identifier}
            </p>
          </div>
          <div className="flex flex-col items-end shrink-0">
            <span className="text-[10px] text-white/30 uppercase tracking-wider">
              Trends
            </span>

            <span className="text-xl font-mono font-bold">
              {mindshare.toFixed(1)}%
            </span>
            <span
              className={`text-xs flex items-center gap-1 mt-0.5 ${sparklineDelta >= 0 ? "text-[#22C55E]" : "text-[#EF4444]"}`}
            >
              {sparklineDelta >= 0 ? (
                <TrendingUp size={11} />
              ) : (
                <TrendingDown size={11} />
              )}
              {Math.abs(sparklineDelta / 100).toFixed(1)}%
            </span>
          </div>
        </div>

        {sparkline.length > 1 && <MiniLineChart data={sparkline} />}

        <div className="flex items-center justify-between pt-4 border-t border-white/[0.05]">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-white/30 uppercase tracking-wider">
              Vol
            </span>
            <span className="text-xs font-mono text-white/70">
              {formatVolume(market.volume_24h_lamports)} SOL
            </span>
          </div>
          <div className="bg-[rgba(156,147,232,0.12)] text-[#9C93E8] px-2.5 py-1 rounded-md text-[11px] font-mono font-bold">
            {ratchet.toFixed(1)}x
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function Trends() {
  const { data: markets = [], isLoading } = useMarkets({
    type: "topic",
    sortBy: "mindshare",
    limit: 50,
    sparkline: true,
  });

  return (
    <div className="w-full h-full flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-display font-bold">Trends</h1>
        <p className="text-white/40 text-sm">
          Trending attention markets curated by Elfa AI
        </p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-6 h-52 animate-pulse"
            />
          ))}
        </div>
      ) : markets.length === 0 ? (
        <div className="w-full py-24 flex flex-col items-center justify-center text-white/30">
          <p className="text-base">No trends found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {markets.map((market) => (
            <TrendCard key={market.identifier} market={market} />
          ))}
        </div>
      )}
    </div>
  );
}
