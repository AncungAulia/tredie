"use client";
import { useRef, useState, useEffect } from "react";
import type { CSSProperties } from "react";
import { usePathname } from "next/navigation";
import { useMarkets } from "@/hooks/useMarkets";
import type { Market } from "@/types/api";
import Link from "next/link";
import { TrendingUp, TrendingDown, Crown } from "lucide-react";
import dynamic from "next/dynamic";
const CardChart = dynamic(() => import("@/components/chart/CardChart"), {
  ssr: false,
});

function formatMcapUsd(
  fdvLamports: string | undefined,
  solPriceUsd: number,
): string {
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

function TopicCard({
  market,
  solPriceUsd,
}: {
  market: Market;
  solPriceUsd: number;
}) {
  const mindshare = market.current_mindshare_bps / 100;
  const rawSparkline = market.price_sparkline_24h ?? [];
  const sparklineDelta =
    rawSparkline.length >= 2 && rawSparkline[0] !== 0
      ? ((rawSparkline[rawSparkline.length - 1] - rawSparkline[0]) /
          rawSparkline[0]) *
        100
      : 0;
  const ratchet = market.ratchet_multiplier_bps / 10_000;
  const color = sparklineDelta >= 0 ? "#9C93E8" : "#EF4444";

  return (
    <Link href={`/topics/${encodeURIComponent(market.identifier)}`}>
      <div className="group bg-white/[0.03] border border-white/[0.07] hover:border-[rgba(156,147,232,0.30)] hover:bg-[rgba(156,147,232,0.04)] transition-all duration-200 rounded-2xl p-6 cursor-pointer flex flex-col gap-5">
        <div className="flex justify-between items-start gap-4">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <Avatar market={market} size={40} />
            <div className="flex-1 min-w-0">
              <h3 className="text-white font-sans font-bold text-lg leading-snug truncate group-hover:text-[#B3ABF0] transition-colors">
                {market.display_name ?? market.identifier}
              </h3>
              <p className="text-white/30 text-xs font-mono mt-1.5">
                {market.identifier}
              </p>
            </div>
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
          <span className="text-white text-2xl font-mono font-bold">
            {formatMcapUsd(market.fdv_lamports, solPriceUsd)}
          </span>
          <span className="text-white/30 text-xs font-mono uppercase tracking-wider">
            Mcap
          </span>
        </div>

        {/* Desktop card chart — OHLC data, same pipeline as token detail 24H */}
        <CardChart
          identifier={market.identifier}
          market={market}
          color={color}
          heightClass="h-12"
        />

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

function MobileTopicCard({
  market,
  solPriceUsd,
}: {
  market: Market;
  solPriceUsd: number;
}) {
  const mindshare = market.current_mindshare_bps / 100;
  const rawSparkline = market.price_sparkline_24h ?? [];
  const sparklineDelta =
    rawSparkline.length >= 2 && rawSparkline[0] !== 0
      ? ((rawSparkline[rawSparkline.length - 1] - rawSparkline[0]) /
          rawSparkline[0]) *
        100
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
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <Avatar market={market} size={48} className="mt-0.5" />
            <div className="flex-1 min-w-0">
              <h2 className="text-2xl font-bold text-white leading-tight truncate">
                {market.display_name ?? market.identifier}
              </h2>
              <p className="text-white/30 text-xs font-mono mt-1">
                {market.identifier}
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end shrink-0">
            <span className="text-[10px] text-white/30 uppercase tracking-wider">
              Topics
            </span>
            <span className="text-2xl font-mono font-bold">
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

        <div className="flex items-baseline gap-2 mt-3">
          <span className="text-3xl font-mono font-bold text-white">
            {formatMcapUsd(market.fdv_lamports, solPriceUsd)}
          </span>
          <span className="text-white/30 text-xs font-mono uppercase tracking-wider">
            Mcap
          </span>
        </div>

        {/* Full-height chart — OHLC data, identical pipeline to token detail 24H */}
        <div className="flex-1 min-h-0 mt-4 rounded-xl overflow-hidden">
          <CardChart
            identifier={market.identifier}
            market={market}
            color={color}
          />
        </div>

        <div className="flex items-center justify-between border-t border-white/[0.06] pt-4 mt-4">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-white/30 uppercase tracking-wider">
              Vol
            </span>
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

function timeAgo(dateStr: string | number): string {
  if (!dateStr) return "—";
  const num = Number(dateStr);
  const d = isNaN(num)
    ? new Date(dateStr as string)
    : new Date(num < 1e10 ? num * 1000 : num);
  if (isNaN(d.getTime())) return "—";
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const HERO_TITLES: Record<TopicCategory, string> = {
  Trending: "What's Trending",
  Latest: "What's New",
  Top: "Top Markets by Cap",
};

function HeroSection({
  markets,
  solPriceUsd,
  category,
}: {
  markets: Market[];
  solPriceUsd: number;
  category: TopicCategory;
}) {
  const main = markets[0];
  const secondary = markets.slice(1, 3);
  if (!main) return null;

  const mainMindshare = (main.current_mindshare_bps / 100).toFixed(1);
  const mainRatchet = (main.ratchet_multiplier_bps / 10_000).toFixed(1);
  const mainMcap = formatMcapUsd(main.fdv_lamports, solPriceUsd);

  return (
    <div className="hidden md:flex flex-col gap-4">
      <h2 className="text-2xl font-bold text-white">{HERO_TITLES[category]}</h2>
      <div className="grid grid-cols-[1fr_280px] gap-3 h-[380px]">
        {/* Left — full-bleed image, text overlay */}
        <Link
          href={`/topics/${encodeURIComponent(main.identifier)}`}
          className="h-full"
        >
          <div className="group relative h-full rounded-2xl overflow-hidden cursor-pointer bg-white/[0.04]">
            <div className="absolute inset-0" style={backdropStyle(main.identifier)} />
            <Monogram label={main.display_name ?? main.identifier} size={150} />
            {main.image_url && (
              <img
                src={main.image_url}
                alt={main.display_name ?? main.identifier}
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-5">
              <h2 className="text-white font-bold text-xl leading-snug line-clamp-2 drop-shadow">
                {main.display_name ?? main.identifier}
              </h2>
              <div className="flex items-center gap-3 mt-3 flex-wrap">
                {category === "Trending" && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/10 backdrop-blur-sm border border-white/15 text-white/80 text-xs font-mono rounded-full">
                    <Crown size={10} fill="white" className="text-white" />
                    Most talked on socials
                  </span>
                )}
                {category === "Latest" && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/10 backdrop-blur-sm border border-white/15 text-white/80 text-xs font-mono rounded-full">
                    <Crown size={10} fill="white" className="text-white" />
                    Just launched · {timeAgo(main.created_at)}
                  </span>
                )}
                {category === "Top" && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/10 backdrop-blur-sm border border-white/15 text-white/80 text-xs font-mono rounded-full">
                    <Crown size={10} fill="white" className="text-white" />
                    Largest market cap · {mainMcap}
                  </span>
                )}
              </div>
            </div>
          </div>
        </Link>

        {/* Right — 2 stacked full-bleed cards */}
        <div className="flex flex-col gap-3 h-full">
          {secondary.map((market, idx) => (
            <Link
              key={market.identifier}
              href={`/topics/${encodeURIComponent(market.identifier)}`}
              className="flex-1 min-h-0"
            >
              <div className="group relative h-full rounded-2xl overflow-hidden cursor-pointer bg-white/[0.04]">
                <div className="absolute inset-0" style={backdropStyle(market.identifier)} />
                <Monogram label={market.display_name ?? market.identifier} size={64} />
                {market.image_url && (
                  <img
                    src={market.image_url}
                    alt={market.display_name ?? market.identifier}
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 px-4 py-3 flex items-end justify-between gap-2">
                  <h3 className="text-white font-semibold text-sm leading-snug line-clamp-2 flex-1 min-w-0 drop-shadow">
                    {market.display_name ?? market.identifier}
                  </h3>
                  <span className="text-sm font-mono font-bold shrink-0 text-white/40">
                    #{idx + 2}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

type TopicCategory = "Trending" | "Latest" | "Top";

/** Backdrop untuk market tanpa gambar.
 *
 *  Pasar topik (asset_class 6) memang tidak pernah punya gambar — backfill-images
 *  di backend sengaja melewatinya karena tidak ada logo yang bisa dicari untuk
 *  sebuah momen budaya. Jadi di halaman /topics ini kondisi normal, bukan kasus
 *  tepi, dan slot gambar yang kosong tampil sebagai kotak hitam.
 *
 *  Gradien diturunkan dari identifier supaya tiap market dapat warna yang tetap
 *  dan berbeda, tapi masih di dalam rentang violet brand. */
function backdropStyle(seed: string): CSSProperties {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const from = 248 + (h % 44);
  const to = 262 + ((h >> 8) % 40);
  return {
    backgroundImage: `linear-gradient(148deg, hsl(${from} 58% 32%) 0%, hsl(${to} 52% 16%) 58%, #0D0A18 100%)`,
  };
}

function Avatar({
  market,
  size,
  className = "",
}: {
  market: { image_url?: string | null; display_name?: string | null; identifier: string };
  size: number;
  className?: string;
}) {
  const label = market.display_name ?? market.identifier;
  if (market.image_url) {
    return (
      <img
        src={market.image_url}
        alt={label}
        style={{ width: size, height: size }}
        className={`rounded-full object-cover shrink-0 bg-white/10 ${className}`}
        onError={(e) => {
          e.currentTarget.style.display = "none";
        }}
      />
    );
  }
  return (
    <span
      aria-hidden
      style={{ width: size, height: size, fontSize: size * 0.38, ...backdropStyle(market.identifier) }}
      className={`rounded-full shrink-0 flex items-center justify-center font-mono font-bold text-white/70 ${className}`}
    >
      {label.slice(0, 2).toUpperCase()}
    </span>
  );
}

function Monogram({ label, size }: { label: string; size: number }) {
  return (
    <span
      aria-hidden
      className="absolute inset-0 flex items-center justify-center font-mono font-bold text-white/[0.12] select-none tracking-tight"
      style={{ fontSize: size }}
    >
      {label.slice(0, 2).toUpperCase()}
    </span>
  );
}

export default function Topics() {
  const pathname = usePathname();
  const isDetailRoute = pathname.startsWith("/topics/");
  const [activeCategory, setActiveCategory] =
    useState<TopicCategory>("Trending");
  const [showToggle, setShowToggle] = useState(true);
  const mobileScrollRef = useRef<HTMLDivElement>(null);
  const lastScrollTop = useRef(0);
  const isChangingCategory = useRef(false);
  const categoryEffectMounted = useRef(false);
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

  const { data: topMcapData, isLoading: loadingTopMcap } = useMarkets({
    type: "topic",
    sortBy: "market_cap",
    limit: 50,
    sparkline: true,
  });

  const trendingMarkets = trendingData?.markets ?? [];
  const newestMarkets = newestData?.markets ?? [];
  const topMcapMarkets = topMcapData?.markets ?? [];
  const solPriceUsd =
    (trendingData ?? newestData ?? topMcapData)?.solPriceUsd ?? 0;

  const isLoading =
    activeCategory === "Trending"
      ? loadingTrending
      : activeCategory === "Latest"
        ? loadingNewest
        : loadingTopMcap;
  const markets =
    activeCategory === "Trending"
      ? trendingMarkets
      : activeCategory === "Latest"
        ? newestMarkets
        : topMcapMarkets;

  const categories: TopicCategory[] = ["Trending", "Latest", "Top"];

  useEffect(() => {
    if (!categoryEffectMounted.current) {
      categoryEffectMounted.current = true;
      return;
    }
    requestAnimationFrame(() => {
      mobileScrollRef.current?.scrollTo({ top: 0, behavior: "instant" });
      lastScrollTop.current = 0;
    });
  }, [activeCategory]);

  // Show toggle again when returning from detail to list
  useEffect(() => {
    if (!isDetailRoute) setShowToggle(true);
  }, [isDetailRoute]);

  function handleCategoryChange(cat: TopicCategory) {
    isChangingCategory.current = true;
    setTimeout(() => {
      isChangingCategory.current = false;
    }, 600);
    setActiveCategory(cat);
    setShowToggle(true);
  }

  const activeIdx = categories.indexOf(activeCategory);

  const categoryToggle = (mobile: boolean) => (
    <div
      className={
        mobile
          ? `md:hidden fixed top-[4rem] left-0 right-0 z-20 flex justify-center pb-2 transition-all duration-300 ${showToggle ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-3 pointer-events-none"}`
          : "flex items-center"
      }
    >
      <div
        className={
          mobile
            ? "w-full mx-6 flex items-center"
            : `relative flex p-1 rounded-full border bg-white/[0.04] border-white/[0.07]`
        }
      >
        {/* Background pill only for desktop */}
        {!mobile && (
          <span
            aria-hidden="true"
            className="absolute top-1 bottom-1 rounded-full bg-[rgba(156,147,232,0.15)] border border-[rgba(156,147,232,0.30)] transition-transform duration-300 ease-out will-change-transform pointer-events-none"
            style={{
              left: "0.25rem",
              width: `calc((100% - 0.5rem) / ${categories.length})`,
              transform: `translateX(${activeIdx * 100}%)`,
            }}
          />
        )}

        {categories.map((cat, idx) => (
          <button
            key={cat}
            onClick={() => handleCategoryChange(cat)}
            className={
              mobile
                ? `flex-1 py-3 text-center text-xs tracking-normal transition-colors duration-300 cursor-pointer ${activeCategory === cat ? "text-[#9C93E8] font-bold" : "text-white/40 font-normal"}`
                : `relative z-10 w-24 py-2 text-center text-sm font-medium transition-colors duration-300 rounded-full cursor-pointer ${activeCategory === cat ? "text-[#9C93E8]" : "text-white/50 hover:text-white"}`
            }
          >
            {cat}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <>
      <div
        ref={mobileScrollRef}
        className={`md:hidden fixed inset-0 z-10 overflow-y-scroll snap-y snap-mandatory overscroll-y-none${isDetailRoute ? " invisible pointer-events-none" : ""}`}
        aria-hidden={isDetailRoute || undefined}
      >
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-dvh snap-start bg-white/[0.03] animate-shimmer"
              />
            ))
          : markets.map((market) => (
              <MobileTopicCard
                key={market.identifier}
                market={market}
                solPriceUsd={solPriceUsd}
              />
            ))}
      </div>

      {!isDetailRoute && categoryToggle(true)}

      {!isDetailRoute && (
        <div className="hidden md:flex flex-col gap-8 w-full">
          {categoryToggle(false)}

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-6 h-52 animate-shimmer"
                />
              ))}
            </div>
          ) : markets.length === 0 ? (
            <div className="w-full py-24 flex flex-col items-center justify-center text-white/30">
              <p className="text-base">No topics found.</p>
            </div>
          ) : (
            <>
              <HeroSection
                markets={markets.slice(0, 3)}
                solPriceUsd={solPriceUsd}
                category={activeCategory}
              />
              {markets.length > 3 && (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {markets.slice(3).map((market) => (
                    <TopicCard
                      key={market.identifier}
                      market={market}
                      solPriceUsd={solPriceUsd}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </>
  );
}
