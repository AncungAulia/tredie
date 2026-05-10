"use client";
import { useId, useRef, useState, useEffect } from "react";
import { useMarkets } from "@/hooks/useMarkets";
import type { Market } from "@/types/api";
import Link from "next/link";
import { TrendingUp, TrendingDown } from "lucide-react";

function MiniLineChart({
  data,
  color = "#9C93E8",
  tall = false,
}: {
  data: number[];
  color?: string;
  tall?: boolean;
}) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const isFlat = max === min;
  const range = max - min || 1;
  const h = tall ? 180 : 48;
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
  const gradientId = `grad-${id.replace(/:/g, "")}`;

  const lineRef = useRef<SVGPolylineElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = lineRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.1 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className={tall ? "w-full h-full" : "w-full h-12"}
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
        style={{ opacity: visible ? 1 : 0, transition: "opacity 0.3s ease-out" }}
      />
      <polyline
        ref={lineRef}
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          strokeDasharray: 1000,
          strokeDashoffset: visible ? 0 : 1000,
          transition: visible ? "stroke-dashoffset 2.5s ease-out" : "none",
        }}
      />
    </svg>
  );
}

function formatMcapUsd(fdvLamports: string | undefined, solPriceUsd: number): string {
  if (!fdvLamports || solPriceUsd === 0) return "—";
  const usd = (Number(fdvLamports) / 1e9) * solPriceUsd;
  if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(1)}M`;
  if (usd >= 1_000) return `$${(usd / 1_000).toFixed(1)}K`;
  if (usd >= 1) return `$${usd.toFixed(0)}`;
  return `$${usd.toFixed(2)}`;
}

function formatVolume(lamports: string): string {
  const sol = Number(lamports) / 1e9;
  if (sol >= 1_000_000) return `${(sol / 1_000_000).toFixed(1)}M`;
  if (sol >= 1_000) return `${(sol / 1_000).toFixed(1)}K`;
  return sol.toFixed(2);
}

function TopicCard({ market, solPriceUsd }: { market: Market; solPriceUsd: number }) {
  const mindshare = market.current_mindshare_bps / 100;
  const rawSparkline = (market.price_sparkline_24h ?? []);
  const sparkline = rawSparkline.length >= 2 ? rawSparkline : [0, 0];
  const sparklineDelta =
    rawSparkline.length >= 2 && rawSparkline[0] !== 0
      ? ((rawSparkline[rawSparkline.length - 1] - rawSparkline[0]) / rawSparkline[0]) * 100
      : 0;
  const ratchet = market.ratchet_multiplier_bps / 10_000;

  return (
    <Link href={`/topics/${encodeURIComponent(market.identifier)}`}>
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
              Trend
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
              {Math.abs(sparklineDelta).toFixed(1)}%
            </span>
          </div>
        </div>

        <div className="flex items-baseline gap-2">
          <span className="text-white text-2xl font-mono font-bold">{formatMcapUsd(market.fdv_lamports, solPriceUsd)}</span>
          <span className="text-white/30 text-xs font-mono uppercase tracking-wider">Mcap</span>
        </div>

        <MiniLineChart data={sparkline} />

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

function MobileTopicCard({ market, solPriceUsd }: { market: Market; solPriceUsd: number }) {
  const mindshare = market.current_mindshare_bps / 100;
  const rawSparkline = (market.price_sparkline_24h ?? []);
  const sparkline = rawSparkline.length >= 2 ? rawSparkline : [0, 0];
  const sparklineDelta =
    rawSparkline.length >= 2 && rawSparkline[0] !== 0
      ? ((rawSparkline[rawSparkline.length - 1] - rawSparkline[0]) / rawSparkline[0]) * 100
      : 0;
  const ratchet = market.ratchet_multiplier_bps / 10_000;
  const color = sparklineDelta >= 0 ? "#9C93E8" : "#EF4444";
  const ticker = market.identifier.includes(":")
    ? market.identifier.split(":")[1]
    : market.identifier;

  return (
    <Link
      href={`/topics/${encodeURIComponent(market.identifier)}`}
      className="block h-dvh snap-start snap-always"
    >
      <div className="h-full flex flex-col pt-28 px-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-bold text-white leading-tight truncate">
              {market.display_name ?? market.identifier}
            </h2>
            <p className="text-white/30 text-xs font-mono mt-1">{market.identifier}</p>
          </div>
          <div className="flex flex-col items-end shrink-0">
            <span className="text-[10px] text-white/30 uppercase tracking-wider">Topics</span>
            <span className="text-2xl font-mono font-bold">{mindshare.toFixed(1)}%</span>
            <span className={`text-xs flex items-center gap-1 mt-0.5 ${sparklineDelta >= 0 ? "text-[#22C55E]" : "text-[#EF4444]"}`}>
              {sparklineDelta >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
              {Math.abs(sparklineDelta).toFixed(1)}%
            </span>
          </div>
        </div>

        <div className="flex items-baseline gap-2 mt-3">
          <span className="text-3xl font-mono font-bold text-white">{formatMcapUsd(market.fdv_lamports, solPriceUsd)}</span>
          <span className="text-white/30 text-xs font-mono uppercase tracking-wider">Mcap</span>
        </div>

        <div className="flex-1 min-h-0 mt-4">
          <MiniLineChart data={sparkline} color={color} tall />
        </div>

        <div className="flex items-center justify-between border-t border-white/[0.06] pt-4 mt-4">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-white/30 uppercase tracking-wider">Vol</span>
            <span className="text-sm font-mono text-white/70">
              {formatVolume(market.volume_24h_lamports)} SOL
            </span>
          </div>
          <div className="bg-[rgba(156,147,232,0.12)] text-[#9C93E8] px-3 py-1.5 rounded-lg text-sm font-mono font-bold">
            {ratchet.toFixed(1)}x
          </div>
        </div>

        <div className="py-4">
          <div className="w-full h-12 rounded-xl bg-[#00FF47] flex items-center justify-center font-bold text-sm text-black">
            Buy {ticker}
          </div>
        </div>

        <div className="h-16 shrink-0" />
      </div>
    </Link>
  );
}

type TopicCategory = "Trending" | "Latest";

export default function Topics() {
  const [activeCategory, setActiveCategory] = useState<TopicCategory>("Trending");
  const [showToggle, setShowToggle] = useState(true);
  const mobileScrollRef = useRef<HTMLDivElement>(null);
  const lastScrollTop = useRef(0);
  const isChangingCategory = useRef(false);

  useEffect(() => {
    const el = mobileScrollRef.current;
    if (!el) return;
    const onScroll = () => {
      if (isChangingCategory.current) return;
      const st = el.scrollTop;
      if (st > lastScrollTop.current) setShowToggle(false);
      else if (st < lastScrollTop.current) setShowToggle(true);
      lastScrollTop.current = st;
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  const { data: trendingData, isLoading: loadingTrending } = useMarkets({
    type: "topic",
    sortBy: "mindshare",
    limit: 50,
    sparkline: true,
  });

  const { data: newestData, isLoading: loadingNewest } = useMarkets({
    type: "topic",
    sortBy: "created_at",
    order: "desc",
    limit: 50,
    sparkline: true,
  });

  const trendingMarkets = trendingData?.markets ?? [];
  const newestMarkets = newestData?.markets ?? [];
  const solPriceUsd = (trendingData ?? newestData)?.solPriceUsd ?? 0;

  const isLoading = activeCategory === "Trending" ? loadingTrending : loadingNewest;
  const markets = activeCategory === "Trending" ? trendingMarkets : newestMarkets;

  const categories: TopicCategory[] = ["Trending", "Latest"];

  useEffect(() => {
    requestAnimationFrame(() => {
      mobileScrollRef.current?.scrollTo({ top: 0, behavior: "instant" });
      lastScrollTop.current = 0;
    });
  }, [activeCategory]);

  function handleCategoryChange(cat: TopicCategory) {
    isChangingCategory.current = true;
    setTimeout(() => { isChangingCategory.current = false; }, 600);
    setActiveCategory(cat);
    setShowToggle(true);
  }

  const activeIdx = categories.indexOf(activeCategory);

  const categoryToggle = (mobile: boolean) => (
    <div className={mobile
      ? `md:hidden fixed top-[4.25rem] left-0 right-0 z-20 flex justify-center py-2 transition-all duration-300 ${showToggle ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-3 pointer-events-none"}`
      : "flex items-center"
    }>
      <div className={`relative flex p-1 rounded-full border ${mobile ? "bg-white/[0.08] backdrop-blur-md border-white/[0.08]" : "bg-white/[0.04] border-white/[0.07]"}`}>
        <span
          aria-hidden="true"
          className="absolute top-1 bottom-1 rounded-full bg-[rgba(156,147,232,0.15)] border border-[rgba(156,147,232,0.30)] transition-transform duration-300 ease-out will-change-transform pointer-events-none"
          style={{
            left: "0.25rem",
            width: `calc((100% - 0.5rem) / ${categories.length})`,
            transform: `translateX(${activeIdx * 100}%)`,
          }}
        />
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => handleCategoryChange(cat)}
            className={`relative z-10 flex-1 text-center whitespace-nowrap font-medium transition-colors duration-300 rounded-full ${
              mobile
                ? `px-5 py-1.5 text-xs ${activeCategory === cat ? "text-[#9C93E8]" : "text-white/50"}`
                : `px-6 py-2 text-sm ${activeCategory === cat ? "text-[#9C93E8]" : "text-white/50 hover:text-white"}`
            }`}
          >
            {cat}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <>
      {categoryToggle(true)}

      <div ref={mobileScrollRef} className="md:hidden fixed inset-0 z-10 overflow-y-scroll snap-y snap-mandatory">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-dvh snap-start bg-white/[0.03] animate-shimmer" />
            ))
          : markets.map((market) => (
              <MobileTopicCard key={market.identifier} market={market} solPriceUsd={solPriceUsd} />
            ))}
      </div>

      <div className="hidden md:flex flex-col gap-8 w-full">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-display font-bold">Topics</h1>
        </div>

        {categoryToggle(false)}

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-6 h-52 animate-shimmer" />
            ))}
          </div>
        ) : markets.length === 0 ? (
          <div className="w-full py-24 flex flex-col items-center justify-center text-white/30">
            <p className="text-base">No topics found.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {markets.map((market) => (
              <TopicCard key={market.identifier} market={market} solPriceUsd={solPriceUsd} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
