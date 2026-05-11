"use client";
import React, { useState, useMemo, useEffect, useRef } from "react";
import { motion, useScroll, useTransform, useMotionValueEvent, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";
import { Drawer } from "vaul";
import { useQueryClient } from "@tanstack/react-query";
import { useTradeAction } from "@/hooks/useTradeAction";
import { useWalletBalance } from "@/hooks/useWalletBalance";
import { useWallets } from "@privy-io/react-auth/solana";
import { usePrivy, useLogin } from "@privy-io/react-auth";
import { useMarketDetail } from "@/hooks/useMarketDetail";
import { useMarketRealtime } from "@/hooks/useMarketRealtime";
import { useOHLC } from "@/hooks/useOHLC";
import { ArrowLeft, Copy, Info } from "lucide-react";
import { toast } from "sonner";
import ScaleLoader from "react-spinners/ScaleLoader";
import Link from "next/link";
import dynamic from "next/dynamic";
import type { OHLCInterval } from "@/types/api";
import { useRouter } from "next/navigation";

const TradingViewChart = dynamic(
  () => import("@/components/chart/TradingViewChart"),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full animate-shimmer bg-white/[0.03]" />
    ),
  },
);

type TimeRange = "24H" | "1W" | "1M" | "ALL";

const TIME_RANGES: TimeRange[] = ["24H", "1W", "1M", "ALL"];

const RANGE_TO_INTERVAL: Record<TimeRange, OHLCInterval> = {
  "24H": "5m",
  "1W": "1h",
  "1M": "4h",
  ALL: "4h",
};

const RANGE_LIMIT: Record<TimeRange, number> = {
  "24H": 300,
  "1W": 200,
  "1M": 200,
  ALL: 400,
};

const RANGE_LOOKBACK_SEC: Record<TimeRange, number> = {
  "24H": 24 * 3600,
  "1W": 7 * 24 * 3600,
  "1M": 30 * 24 * 3600,
  ALL: 365 * 24 * 3600,
};

// Step per titik di chart (time-based, bukan trade-based)
const CHART_STEP_SEC: Record<TimeRange, number> = {
  "24H": 10 * 60,
  "1W": 30 * 60,
  "1M": 1 * 3600,
  ALL: 1 * 3600,
};

function formatSol(lamports: number): string {
  const sol = lamports / 1e9;
  if (sol < 0.0001) return sol.toFixed(7);
  if (sol < 0.01) return sol.toFixed(5);
  if (sol < 1) return sol.toFixed(4);
  return sol.toFixed(3);
}

function formatPrice(solPerToken: number): string {
  if (!isFinite(solPerToken) || solPerToken <= 0) return "0";
  if (solPerToken >= 1) return solPerToken.toFixed(3);
  if (solPerToken >= 0.001) return solPerToken.toFixed(5);
  const exp = Math.max(Math.floor(Math.log10(solPerToken)), -12);
  const decimals = Math.min(-exp + 2, 12);
  return solPerToken.toFixed(decimals).replace(/\.?0+$/, "") || "0";
}

function formatVolume(lamports: string): string {
  const sol = Number(lamports) / 1e9;
  if (sol >= 1_000_000) return `${(sol / 1_000_000).toFixed(1)}M`;
  if (sol >= 1_000) return `${(sol / 1_000).toFixed(1)}K`;
  return sol.toFixed(2);
}

function formatTokenAmount(amount: number): string {
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(2)}M`;
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(2)}K`;
  if (amount >= 1) return amount.toFixed(2);
  return amount.toFixed(4);
}

function formatMcapUsd(
  fdvLamports: string | undefined,
  solPriceUsd: number | undefined,
): string {
  if (!fdvLamports) return "—";
  const sol = Number(fdvLamports) / 1e9;
  if (!solPriceUsd) {
    if (sol >= 1_000_000) return `${(sol / 1_000_000).toFixed(1)}M SOL`;
    if (sol >= 1_000) return `${(sol / 1_000).toFixed(1)}K SOL`;
    return `${sol.toFixed(1)} SOL`;
  }
  const usd = sol * solPriceUsd;
  if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(1)}M`;
  if (usd >= 1_000) return `$${(usd / 1_000).toFixed(1)}K`;
  if (usd >= 1) return `$${usd.toFixed(0)}`;
  return `$${usd.toFixed(2)}`;
}

export default function TokenDetail({ id }: { id: string }) {
  const router = useRouter();
  const identifier = decodeURIComponent(id);
  const handleBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) router.back();
    else router.push("/tokens");
  };

  const [activeTab, setActiveTab] = useState<"trades" | "holders">("trades");
  const [tradeType, setTradeType] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("0.01");
  const [timeRange, setTimeRange] = useState<TimeRange>("24H");
  const [copied, setCopied] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [touched, setTouched] = useState(false);
  const [tradesLimit, setTradesLimit] = useState(20);
  const pendingTradeRef = useRef<{ type: "buy" | "sell"; amount: number; estimatedOut: number } | null>(null);
  const queryClient = useQueryClient();
  const { execute, status, error, reset } = useTradeAction();
  const { authenticated } = usePrivy();
  const { login } = useLogin();
  const { wallets } = useWallets();
  // Prefer external wallet (Phantom, etc.) over embedded Privy wallet.
  // Embedded wallets have walletClientType === 'privy' and start with 0 SOL.
  const walletAddress =
    wallets.find((w) => (w as any).walletClientType !== "privy")?.address ??
    wallets[0]?.address;

  const interval = RANGE_TO_INTERVAL[timeRange];
  const limit = RANGE_LIMIT[timeRange];
  const { data: market, isLoading: loadingMarket } =
    useMarketDetail(identifier);
  useMarketRealtime(identifier, market?.pda);
  const { data: ohlcData, isLoading: loadingOHLC } = useOHLC(
    identifier,
    interval,
    limit,
  );
  const { solBalance, tokenBalance } = useWalletBalance(
    walletAddress,
    market?.mint,
  );
  const solBalanceSol = solBalance / 1e9;
  const tokenBalanceUi = Number(tokenBalance) / 1e6;

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (status === "success") {
      const p = pendingTradeRef.current;
      if (p) {
        const isBuy = p.type === "buy";
        const solscanUrl = market?.mint ? `https://solscan.io/token/${market.mint}?cluster=devnet` : null;
        const descText = isBuy
          ? `+${formatTokenAmount(p.estimatedOut)} ${ticker}`
          : `+${p.estimatedOut < 0.0001 ? p.estimatedOut.toFixed(6) : p.estimatedOut.toFixed(4)} SOL`;

        toast("Trade successful", {
          description: (
            <span style={{ color: "#00FF47", fontFamily: "ui-monospace, monospace", fontSize: "0.8rem" }}>
              {descText}
            </span>
          ),
          action: solscanUrl
            ? { label: "View", onClick: () => window.open(solscanUrl, "_blank") }
            : undefined,
          icon: null,
          duration: 4000,
        });
        pendingTradeRef.current = null;
      }

      queryClient.invalidateQueries({ queryKey: ["market", identifier] });
      queryClient.invalidateQueries({
        queryKey: ["balance", "sol", walletAddress],
      });
      queryClient.invalidateQueries({
        queryKey: ["balance", "token", walletAddress, market?.mint],
      });

      const t1 = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["ohlc", identifier] });
        queryClient.invalidateQueries({ queryKey: ["market", identifier] });
        queryClient.invalidateQueries({
          queryKey: ["portfolio", walletAddress],
        });
      }, 4000);

      setSheetOpen(false);

      const t2 = setTimeout(reset, 2000);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }
  }, [status, reset, queryClient, identifier, walletAddress, market?.mint, market]);

  useEffect(() => {
    if (status === "error" && error) {
      toast.error("Trade failed", {
        description: error,
        duration: 4000,
      });
    }
  }, [status, error]);

  const { scrollY } = useScroll();
  const heroY = useTransform(scrollY, [0, 400], [0, -80]);
  const [showStickyHeader, setShowStickyHeader] = useState(false);
  useMotionValueEvent(scrollY, "change", (latest) => {
    setShowStickyHeader(latest > 200);
  });

  const spotPrice = (() => {
    if (!market) return 0;
    const denom = Number(market.virtual_token_supply) - Number(market.tokens_minted);
    if (denom <= 0) return 0;
    return (Number(market.real_sol_reserves) + Number(market.base_virtual_sol)) / denom / 1e9;
  })();

  const tokensMinted = market ? Number(market.tokens_minted) : 0;

  const chartColor = "#9C93E8";

  // Harga token dalam SOL per 1 token (human-readable, bukan raw)
  // spotPrice = lamports/raw_token / 1e9 = SOL per raw token
  // SOL per human token = SOL per raw token × 1e6  (1 token = 1e6 raw)
  const pricePerToken = spotPrice * 1e6;
  const pricePerTokenRef = useRef(pricePerToken);
  pricePerTokenRef.current = pricePerToken;

  const lineData = useMemo(() => {
    const candles = ohlcData?.candles ?? [];
    const now = Math.floor(Date.now() / 1000);
    const lookback = RANGE_LOOKBACK_SEC[timeRange];
    const step = CHART_STEP_SEC[timeRange];
    const windowStart = now - lookback;

    // Sort candles ascending, filter ke dalam window saja
    const sorted = [...candles]
      .map((c) => ({
        time: Number(c.bucket ?? c.time),
        price: Number(c.close) / 1000,
      }))
      .filter((c) => c.time >= windowStart)
      .sort((a, b) => a.time - b.time);

    const from = Math.floor(windowStart / step) * step;

    const result: { time: number; value: number }[] = [];
    let lastPrice = pricePerTokenRef.current;
    let ci = 0;

    for (let t = from; t <= now; t += step) {
      while (ci < sorted.length && sorted[ci].time <= t) {
        lastPrice = sorted[ci].price;
        ci++;
      }
      result.push({ time: t, value: lastPrice });
    }

    if (result.length > 0 && result[result.length - 1].time < now) {
      result.push({ time: now, value: lastPrice });
    }

    const TARGET = 35;
    const sampled =
      result.length > TARGET
        ? Array.from(
            { length: TARGET },
            (_, i) =>
              result[Math.round((i * (result.length - 1)) / (TARGET - 1))],
          )
        : result;

    // Weighted moving average — soften sharp corners for smoother curve rendering
    const passes = 5;
    let out = sampled;
    for (let p = 0; p < passes; p++) {
      out = out.map((d, i) => {
        if (i === 0 || i === out.length - 1) return d;
        return {
          time: d.time,
          value:
            out[i - 1].value * 0.25 + d.value * 0.5 + out[i + 1].value * 0.25,
        };
      });
    }

    return out;
  }, [ohlcData, timeRange]);

  const mindshare = market ? market.current_mindshare_bps / 100 : 0;
  const ratchet = market ? market.ratchet_multiplier_bps / 10_000 : 0;
  const priceDeltaBps = market?.stats?.price_change_24h_bps ?? 0;
  const isPositive = priceDeltaBps >= 0;

  const label = market?.display_name ?? identifier;
  const ticker = identifier.includes(":")
    ? identifier.split(":")[1]
    : identifier;

  const tabCounts = market
    ? {
        trades: market.recent_trades.length,
        holders: Number(market.stats.holders_count),
      }
    : { trades: 0, holders: 0 };

  const TOKEN_DECIMALS = 1e6;
  const parsedAmount = parseFloat(amount || "0");

  const inputError = (() => {
    if (!touched || !authenticated || !(parsedAmount > 0)) return null;
    if (tradeType === "buy" && parsedAmount > solBalanceSol)
      return "Insufficient SOL balance";
    if (tradeType === "sell" && parsedAmount > tokenBalanceUi)
      return "Insufficient token balance";
    return null;
  })();

  // buy: amount is SOL → estimate tokens out; sell: amount is tokens → estimate SOL out
  // pricePerToken = SOL per human token (bukan per raw token)
  // buy:  SOL ÷ (SOL/token) = token
  // sell: token × (SOL/token) = SOL
  const estimatedOutput = (() => {
    if (!(pricePerToken > 0) || !(parsedAmount > 0)) return "—";
    if (tradeType === "buy") {
      const tokens = parsedAmount / pricePerToken;
      return `${formatTokenAmount(tokens)} ${ticker}`;
    }
    const sol = parsedAmount * pricePerToken;
    return `${sol < 0.0001 ? sol.toFixed(6) : parseFloat(sol.toFixed(4)).toString()} SOL`;
  })();

  function handleCopy() {
    navigator.clipboard.writeText(identifier);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (loadingMarket) {
    return (
      <div className="w-full max-w-7xl mx-auto pb-24 animate-shimmer">
        <div className="h-8 w-48 bg-white/10 rounded mb-6" />
        <div className="h-64 bg-white/[0.03] rounded-xl" />
      </div>
    );
  }

  if (!market) {
    return (
      <div className="w-full max-w-7xl mx-auto pb-24 flex flex-col items-center justify-center py-32">
        <p className="text-white/40">Market not found: {identifier}</p>
        <Link
          href="/topics"
          className="mt-4 text-[#9C93E8] text-sm hover:underline"
        >
          ← Back to Topics
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto pb-24 animate-fadeIn">
      {/* Mobile parallax hero */}
      <div className="md:hidden -mx-8 relative overflow-hidden mb-0" style={{ height: 220 }}>
        <motion.div
          style={{ y: heroY, height: 300 }}
          className="absolute inset-0 w-full"
        >
          {market.image_url && !imgError ? (
            <img
              src={market.image_url}
              alt={label}
              className="w-full h-full object-cover"
              onError={() => setImgError(true)}
            />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center"
              style={{ background: "#141420" }}
            >
              <span
                className="font-mono font-bold text-[#9C93E8]"
                style={{ fontSize: 96 }}
              >
                {ticker.slice(0, 1).toUpperCase()}
              </span>
            </div>
          )}
        </motion.div>
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-[#09090B]" />
        {/* Back button overlay */}
        <button
          onClick={handleBack}
          className="absolute top-4 left-4 z-10 flex items-center gap-1.5 text-white/90 bg-black/35 backdrop-blur-sm rounded-full pl-2.5 pr-3.5 py-1.5 transition-colors active:bg-black/55"
        >
          <ArrowLeft size={15} />
          <span className="text-sm font-medium">Back</span>
        </button>
        {/* Bottom text */}
        <div className="absolute bottom-0 left-0 right-0 px-6 pb-4">
          <h1 className="text-xl font-bold text-white leading-tight drop-shadow-lg">
            {label}
          </h1>
        </div>
      </div>

      {/* Mobile sticky mini-header — appears after hero scrolls out */}
      <AnimatePresence>
        {showStickyHeader && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="flex flex-col items-start gap-3 md:hidden fixed top-16 left-0 right-0 z-40 px-4 py-3 bg-[#09090B]/95 backdrop-blur-md border-b border-white/[0.05]"
          >
            <button
              onClick={handleBack}
              className="text-white/50 flex items-center gap-1 text-sm hover:text-white transition-colors shrink-0 p-1 -ml-1"
            >
              <ArrowLeft size={18} />
              Back
            </button>
           
            <span className="text-white font-semibold text-sm">
              {label}
            </span>
          
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="mb-6 sm:mb-8">
        {/* Desktop: back button */}
        <button
          onClick={handleBack}
          className="hidden md:inline-flex cursor-pointer items-center gap-1.5 text-white/40 hover:text-white/70 transition-colors text-sm mb-4"
        >
          <ArrowLeft size={13} />
          Back
        </button>

        {/* Desktop: noise.xyz hero */}
        <div
          className="hidden md:block relative w-full rounded-xl overflow-hidden mb-5"
          style={{ height: 264 }}
        >
          {market.image_url && !imgError ? (
            <img
              src={market.image_url}
              alt={label}
              className="w-full h-full object-cover"
              onError={() => setImgError(true)}
            />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center"
              style={{ background: "#141420" }}
            >
              <span
                className="font-mono font-bold text-[#9C93E8]"
                style={{ fontSize: 84 }}
              >
                {ticker.slice(0, 1).toUpperCase()}
              </span>
            </div>
          )}
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
          {/* Text overlay at bottom */}
          <div className="absolute bottom-0 left-0 right-0 px-6 pb-5">
            <h1 className="text-2xl font-bold text-white leading-tight">
              {label}
            </h1>
            <div className="flex items-center gap-2.5 mt-1.5 flex-wrap">
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 text-white/45 hover:text-white/75 transition-colors font-mono text-xs"
              >
                {identifier}
                <Copy size={10} />
              </button>
              {copied && (
                <span className="text-[#9C93E8] text-xs">Copied!</span>
              )}
              <span className="text-white/20">·</span>
              <span
                className="font-mono text-sm font-semibold"
                style={{ color: isPositive ? "#00FF47" : "#EF4444" }}
              >
                {isPositive ? "+" : ""}
                {(priceDeltaBps / 100).toFixed(2)}%
              </span>
              <span className="text-white/20">·</span>
              <span className="font-mono text-sm text-white/50">
                {formatVolume(market.stats.volume_24h_lamports)} SOL vol
              </span>
            </div>
          </div>
        </div>

        {/* Mobile: compact stats row */}
        <div className="flex md:hidden items-center gap-5 px-1 mb-2">
          <div className="flex flex-col">
            <span className="text-white font-mono font-bold text-base leading-snug whitespace-nowrap">
              {formatVolume(market.stats.volume_24h_lamports)} SOL
            </span>
            <span className="text-white/30 text-[11px] mt-0.5">24h vol</span>
          </div>
          <div className="flex flex-col">
            <span
              className="font-mono font-bold text-base leading-snug whitespace-nowrap"
              style={{ color: isPositive ? "#00FF47" : "#EF4444" }}
            >
              {isPositive ? "+" : ""}
              {(priceDeltaBps / 100).toFixed(2)}%
            </span>
            <span className="text-white/30 text-[11px] mt-0.5">24h change</span>
          </div>
          <div className="flex items-center gap-1 ml-auto">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 text-white/35 hover:text-white/70 transition-colors font-mono text-[11px]"
            >
              {identifier.length > 12
                ? `${identifier.slice(0, 6)}…${identifier.slice(-4)}`
                : identifier}
              <Copy size={9} />
            </button>
            {copied && (
              <span className="text-[#9C93E8] text-[10px]">Copied!</span>
            )}
          </div>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="flex flex-col md:flex-row gap-6">
        {/* Left column */}
        <div className="flex-1 min-w-0 flex flex-col gap-6">
          {/* Chart */}
          <div
            className="w-full rounded-xl overflow-hidden relative"
            style={{ background: "#000", height: 320 }}
          >
            {loadingOHLC ? (
              <div className="w-full h-full animate-shimmer bg-white/[0.03]" />
            ) : (
              <TradingViewChart
                lineData={lineData}
                candleData={[]}
                chartType="line"
                color={chartColor}
                virtualSupply={
                  market ? Number(market.virtual_token_supply) / 1e6 : undefined
                }
                solPriceUsd={market?.stats.sol_price_usd ?? 0}
              />
            )}
          </div>

          {/* Time range + chart type */}
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-0.5">
              {TIME_RANGES.map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`h-6 overflow-hidden group rounded transition-colors cursor-pointer ${
                    timeRange === range
                      ? "text-white font-semibold"
                      : "text-white/25 hover:text-white/55"
                  }`}
                >
                  <div className="flex flex-col text-xs font-medium group-hover:-translate-y-1/2 transition-transform duration-300 ease-out">
                    <span className="block px-2.5 py-1">{range}</span>
                    <span className="block px-2.5 py-1" aria-hidden="true">
                      {range}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1 bg-white/[0.02] border border-white/[0.06] rounded-xl px-4 py-3">
              <span className="text-white/35 text-[11px] uppercase tracking-wide">
                Market Cap
              </span>
              <span className="font-mono text-sm text-white">
                {formatMcapUsd(
                  market.stats.fdv_lamports,
                  market.stats.sol_price_usd,
                )}
              </span>
            </div>
            <div className="flex flex-col gap-1 bg-white/[0.02] border border-white/[0.06] rounded-xl px-4 py-3">
              <div className="flex items-center gap-1.5">
                <span className="text-white/35 text-[11px] uppercase tracking-wide">
                  Ratchet
                </span>
                <div className="relative group/rinfo">
                  <button className="text-white/30 hover:text-white/60 transition-colors flex items-center justify-center">
                    <Info size={11} />
                  </button>
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 p-2.5 bg-[#1c1c1c] border border-white/10 rounded-lg text-[11px] text-white/65 leading-relaxed invisible group-hover/rinfo:visible opacity-0 group-hover/rinfo:opacity-100 transition-opacity duration-150 z-50 pointer-events-none">
                    The ratchet multiplier raises the bonding curve floor when
                    mindshare peaks. It only moves up. The higher the attention,
                    the higher the price floor.
                  </div>
                </div>
              </div>
              <span className="font-mono text-sm text-white">
                {ratchet.toFixed(1)}x
              </span>
            </div>
          </div>

          {/* Trades / Holders tabs */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-6 border-b border-white/[0.06]">
              {(["trades", "holders"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`h-8 overflow-hidden group relative transition-colors cursor-pointer ${
                    activeTab === tab
                      ? "text-white"
                      : "text-white/35 hover:text-white/65"
                  }`}
                >
                  <div className="flex flex-col text-sm font-medium capitalize group-hover:-translate-y-1/2 transition-transform duration-300 ease-out">
                    <span className="block pb-3">
                      {tab}{" "}
                      <span className="text-white/40 not-capitalize font-mono text-xs">
                        ({tabCounts[tab]})
                      </span>
                    </span>
                    <span className="block pb-3" aria-hidden="true">
                      {tab}{" "}
                      <span className="text-white/40 not-capitalize font-mono text-xs">
                        ({tabCounts[tab]})
                      </span>
                    </span>
                  </div>
                  {activeTab === tab && (
                    <span className="absolute bottom-0 left-0 w-full h-[2px] bg-[#9C93E8] rounded-full" />
                  )}
                </button>
              ))}
            </div>

            {activeTab === "trades" ? (
              market.recent_trades.length > 0 ? (
                <div className="flex flex-col gap-1">
                  {market.recent_trades.slice(0, tradesLimit).map((t) => (
                    <div
                      key={t.signature}
                      className="flex items-center justify-between px-4 py-2.5 bg-white/[0.02] border border-white/[0.05] rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`text-[11px] font-bold px-1.5 py-0.5 rounded ${t.side === 0 ? "bg-[#22C55E]/10 text-[#22C55E]" : "bg-[#EF4444]/10 text-[#EF4444]"}`}
                        >
                          {t.side === 0 ? "BUY" : "SELL"}
                        </span>
                        <span className="font-mono text-xs text-white/50">
                          {t.trader.slice(0, 6)}…{t.trader.slice(-4)}
                        </span>
                      </div>
                      <span className="font-mono text-xs text-white/70">
                        {formatSol(Number(t.sol_amount))}
                      </span>
                    </div>
                  ))}
                  {tradesLimit < market.recent_trades.length && (
                    <button
                      onClick={() => setTradesLimit(market.recent_trades.length)}
                      className="w-full py-2.5 text-xs text-white/35 hover:text-white/60 border border-white/[0.06] rounded-lg transition-colors mt-1"
                    >
                      Show more
                    </button>
                  )}
                </div>
              ) : (
                <div className="w-full text-center py-10 text-white/30 text-sm border border-white/[0.06] rounded-xl bg-white/[0.015]">
                  No trades yet.
                </div>
              )
            ) : market.holders.length > 0 ? (
              <div className="flex flex-col gap-1">
                {market.holders.map((h) => (
                  <div
                    key={h.trader}
                    className="flex items-center justify-between px-4 py-2.5 bg-white/[0.02] border border-white/[0.05] rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-[11px] text-white/30 w-5 text-right">
                        #{h.rank}
                      </span>
                      <span className="font-mono text-xs text-white/50">
                        {h.trader.slice(0, 6)}…{h.trader.slice(-4)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs text-white/30">
                        {(h.share_bps / 100).toFixed(2)}%
                      </span>
                      <span className="font-mono text-xs text-white/70">
                        {(Number(h.net_tokens) / 1e6).toLocaleString(
                          undefined,
                          { maximumFractionDigits: 2 },
                        )}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="w-full text-center py-10 text-white/30 text-sm border border-white/[0.06] rounded-xl bg-white/[0.015]">
                {Number(market.stats.holders_count) > 0
                  ? `${Number(market.stats.holders_count)} trader${Number(market.stats.holders_count) > 1 ? "s" : ""} have traded — no current holders.`
                  : "No holders yet."}
              </div>
            )}
          </div>
        </div>

        {/* Right column: Trading panel — desktop only */}
        <div className="hidden md:block w-[340px] shrink-0">
          <div
            className="border border-white/[0.08] rounded-xl p-5 flex flex-col gap-4 md:sticky md:top-20"
            style={{ background: "#000" }}
          >
            <div className="flex gap-5">
              {(["buy", "sell"] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => { setTradeType(type); setAmount("0.01"); setTouched(false); }}
                  className={`h-[26px] overflow-hidden group transition-colors cursor-pointer capitalize ${
                    tradeType === type
                      ? type === "buy"
                        ? "text-[#00FF47] border-b-2 border-[#00FF47]"
                        : "text-[#EF4444] border-b-2 border-[#EF4444]"
                      : "text-white/35 hover:text-white/65"
                  }`}
                >
                  <div className="flex flex-col text-base font-bold group-hover:-translate-y-1/2 transition-transform duration-300 ease-out">
                    <span className="block pb-0.5">
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </span>
                    <span className="block pb-0.5" aria-hidden="true">
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </span>
                  </div>
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between text-xs text-white/35">
              <span>Balance:</span>
              <span className="font-mono">
                {authenticated
                  ? tradeType === "buy"
                    ? `${(solBalance / 1e9).toFixed(4)} SOL`
                    : `${(Number(tokenBalance) / 1e6).toLocaleString(undefined, { maximumFractionDigits: 2 })} ${ticker}`
                  : "— SOL"}
              </span>
            </div>

            <div
              className="flex items-center gap-2 border rounded-lg px-3 transition-colors focus-within:border-white/30"
              style={{ borderColor: "rgba(255,255,255,0.12)" }}
            >
              <input
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                onBlur={() => setTouched(true)}
                placeholder="0.00"
                className="flex-1 bg-transparent py-3 text-white font-mono text-base outline-none placeholder-white/20 min-w-0"
              />
              <span className="text-white/40 text-sm font-mono shrink-0 transition-all duration-200">
                {tradeType === "buy" ? "SOL" : ticker}
              </span>
            </div>

            {inputError && (
              <p className="text-[#EF4444] text-xs -mt-2">{inputError}</p>
            )}

            <div className="grid grid-cols-4 gap-2">
              {[25, 50, 75, 100].map((pct) => (
                <button
                  key={pct}
                  onClick={() => {
                    if (tradeType === "buy") {
                      const sol = (solBalance / 1e9) * (pct / 100);
                      setAmount(sol.toFixed(4));
                    } else {
                      const tokens = (Number(tokenBalance) / 1e6) * (pct / 100);
                      setAmount(tokens.toFixed(2));
                    }
                  }}
                  className="h-9 overflow-hidden group text-white/45 bg-white/[0.05] hover:bg-white/[0.09] rounded-lg transition-colors cursor-pointer"
                >
                  <div className="flex flex-col text-xs font-medium group-hover:-translate-y-1/2 transition-transform duration-300 ease-out">
                    <span className="block py-2">{pct}%</span>
                    <span className="block py-2" aria-hidden="true">
                      {pct}%
                    </span>
                  </div>
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between py-1 text-sm">
              <span className="text-white/60 font-mono">{estimatedOutput}</span>
              <span className="text-white/30 text-xs">estimated</span>
            </div>

            {!authenticated ? (
              <button
                onClick={() => login()}
                className="w-full h-[50px] rounded-xl font-bold text-sm bg-white/10 text-white hover:bg-white/15 transition-all cursor-pointer border border-white/10"
              >
                Connect Wallet
              </button>
            ) : (
              <button
                disabled={
                  !!inputError ||
                  status === "preparing" ||
                  status === "signing" ||
                  status === "success"
                }
                onClick={() => {
                  pendingTradeRef.current = {
                    type: tradeType,
                    amount: parsedAmount,
                    estimatedOut: tradeType === "buy"
                      ? parsedAmount / pricePerToken
                      : parsedAmount * pricePerToken,
                  };
                  if (tradeType === "buy") {
                    execute({ identifier, side: "buy", solAmount: parsedAmount || 0.01 });
                  } else {
                    execute({ identifier, side: "sell", tokenAmount: String(Math.floor(parsedAmount * TOKEN_DECIMALS)) });
                  }
                }}
                className={`w-full h-[50px] overflow-hidden rounded-xl font-bold text-sm transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${
                  status === "success"
                    ? "bg-white/10 text-white/60"
                    : tradeType === "buy"
                      ? "bg-[#00FF47] text-black hover:brightness-110"
                      : "bg-[#EF4444] text-black hover:brightness-110"
                }`}
              >
                <div
                  className={`flex flex-col transition-transform duration-300 ease-out ${status === "success" ? "-translate-y-1/2" : ""}`}
                >
                  <span className="flex items-center justify-center gap-2 h-[50px]">
                    {(status === "preparing" || status === "signing") && (
                      <ScaleLoader color="currentColor" height={14} width={2} margin={1.5} />
                    )}
                    {status === "preparing"
                      ? "Preparing..."
                      : status === "signing"
                        ? "Signing..."
                        : `${tradeType === "buy" ? "Buy" : "Sell"} ${ticker}`}
                  </span>
                  <span className="flex items-center justify-center h-[50px]" aria-hidden="true">
                    Success
                  </span>
                </div>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Mobile: buy button — portal ke body, bypass transform stacking context */}
      {mounted &&
        createPortal(
          <div className="md:hidden fixed bottom-4 inset-x-0 z-40 px-4 pb-3 pt-4 bg-gradient-to-t from-[#09090B] to-transparent">
            <button
              onClick={() => setSheetOpen(true)}
              className="w-full h-12 rounded-xl font-bold text-sm bg-[#00FF47] text-black active:brightness-90 transition-all"
            >
              {Number(tokenBalance) > 0 ? `Trade ${ticker}` : `Buy ${ticker}`}
            </button>
          </div>,
          document.body,
        )}

      {/* Mobile: vaul Drawer — portal ke body secara internal */}
      <Drawer.Root
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        shouldScaleBackground={false}
      >
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm" />
          <Drawer.Content
            className="fixed bottom-0 left-0 right-0 z-[70] rounded-t-2xl outline-none flex flex-col"
            style={{
              background: "#0a0a0b",
              borderTop: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-white/20 rounded-full" />
            </div>

            <div className="px-5 pb-10 flex flex-col gap-4">
              <Drawer.Title className="text-white font-bold text-base text-center py-2">
                {tradeType === "buy" ? "Buy" : "Sell"} {ticker}
              </Drawer.Title>

              <div className="flex w-full border-b border-white/[0.05] -mt-2 mb-2">
                {(["buy", "sell"] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => { setTradeType(type); setAmount("0.01"); setTouched(false); }}
                    className={`flex-1 py-4 text-center transition-all relative outline-none ${
                      tradeType === type
                        ? type === "buy"
                          ? "text-[#00FF47]"
                          : "text-[#EF4444]"
                        : "text-white/35"
                    }`}
                  >
                    <span className="text-base font-bold capitalize">
                      {type}
                    </span>
                    {tradeType === "buy" === (type === "buy") && (
                      <motion.div
                        layoutId="activeTradeTab"
                        className={`absolute bottom-0 left-0 right-0 h-[2px] ${
                          type === "buy" ? "bg-[#00FF47]" : "bg-[#EF4444]"
                        }`}
                      />
                    )}
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-between text-xs text-white/35">
                <span>Balance:</span>
                <span className="font-mono">
                  {authenticated
                    ? tradeType === "buy"
                      ? `${(solBalance / 1e9).toFixed(4)} SOL`
                      : `${(Number(tokenBalance) / 1e6).toLocaleString(undefined, { maximumFractionDigits: 2 })} ${ticker}`
                    : "— SOL"}
                </span>
              </div>

              <div
                className="flex items-center gap-2 border rounded-lg px-3 focus-within:border-white/30 transition-colors"
                style={{ borderColor: "rgba(255,255,255,0.12)" }}
              >
                <input
                  type="text"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  onBlur={() => setTouched(true)}
                  placeholder="0.00"
                  className="flex-1 bg-transparent py-3 text-white font-mono text-base outline-none placeholder-white/20 min-w-0"
                />
                <span className="text-white/40 text-sm font-mono shrink-0">
                  {tradeType === "buy" ? "SOL" : ticker}
                </span>
              </div>

              {inputError && (
                <p className="text-[#EF4444] text-xs -mt-2">{inputError}</p>
              )}

              <div className="grid grid-cols-4 gap-2">
                {[25, 50, 75, 100].map((pct) => (
                  <button
                    key={pct}
                    onClick={() => {
                      if (tradeType === "buy") {
                        setAmount(
                          ((solBalance / 1e9) * (pct / 100)).toFixed(4),
                        );
                      } else {
                        setAmount(
                          ((Number(tokenBalance) / 1e6) * (pct / 100)).toFixed(
                            2,
                          ),
                        );
                      }
                    }}
                    className="h-9 text-white/45 bg-white/[0.05] hover:bg-white/[0.09] rounded-lg text-xs font-medium transition-colors cursor-pointer"
                  >
                    {pct}%
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-between py-1 text-sm">
                <span className="text-white/60 font-mono">
                  {estimatedOutput}
                </span>
                <span className="text-white/30 text-xs">estimated</span>
              </div>


              {!authenticated ? (
                <button
                  onClick={() => login()}
                  className="w-full h-[50px] rounded-xl font-bold text-sm bg-white/10 text-white hover:bg-white/15 transition-all cursor-pointer border border-white/10"
                >
                  Connect Wallet
                </button>
              ) : (
                <button
                  disabled={
                    !!inputError ||
                    status === "preparing" ||
                    status === "signing" ||
                    status === "success"
                  }
                  onClick={() => {
                    pendingTradeRef.current = {
                      type: tradeType,
                      amount: parsedAmount,
                      estimatedOut: tradeType === "buy"
                        ? parsedAmount / pricePerToken
                        : parsedAmount * pricePerToken,
                    };
                    if (tradeType === "buy") {
                      execute({ identifier, side: "buy", solAmount: parsedAmount || 0.01 });
                    } else {
                      execute({ identifier, side: "sell", tokenAmount: String(Math.floor(parsedAmount * TOKEN_DECIMALS)) });
                    }
                  }}
                  className={`w-full h-[50px] overflow-hidden rounded-xl font-bold text-sm transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${
                    status === "success"
                      ? "bg-white/10 text-white/60"
                      : tradeType === "buy"
                        ? "bg-[#00FF47] text-black hover:brightness-110"
                        : "bg-[#EF4444] text-black hover:brightness-110"
                  }`}
                >
                  <div
                    className={`flex flex-col transition-transform duration-300 ease-out ${status === "success" ? "-translate-y-1/2" : ""}`}
                  >
                    <span className="flex items-center justify-center gap-2 h-[50px]">
                      {(status === "preparing" || status === "signing") && (
                        <ScaleLoader color="currentColor" height={14} width={2} margin={1.5} />
                      )}
                      {status === "preparing"
                        ? "Preparing..."
                        : status === "signing"
                          ? "Signing..."
                          : `${tradeType === "buy" ? "Buy" : "Sell"} ${ticker}`}
                    </span>
                    <span className="flex items-center justify-center h-[50px]" aria-hidden="true">
                      Success
                    </span>
                  </div>
                </button>
              )}
            </div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    </div>
  );
}
