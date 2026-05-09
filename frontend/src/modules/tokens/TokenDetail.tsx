"use client";
import React, { useState, useMemo, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTradeAction } from "@/hooks/useTradeAction";
import { usePrivy, useLogin } from "@privy-io/react-auth";
import { useWallets } from "@privy-io/react-auth/solana";
import { useWalletBalance } from "@/hooks/useWalletBalance";
import { useMarketDetail } from "@/hooks/useMarketDetail";
import { useOHLC } from "@/hooks/useOHLC";
import { ArrowLeft, Copy, BarChart2, TrendingUp } from "lucide-react";
import Link from "next/link";
import TradingViewChart from "@/components/chart/TradingViewChart";
import type { OHLCInterval } from "@/types/api";

type TimeRange = "24H" | "1W" | "1M" | "ALL";
type ChartType = "line" | "candle";

const TIME_RANGES: TimeRange[] = ["24H", "1W", "1M", "ALL"];

const RANGE_TO_INTERVAL: Record<TimeRange, OHLCInterval> = {
  "24H": "5m",
  "1W": "1h",
  "1M": "4h",
  "ALL": "1d",
};

const RANGE_LIMIT: Record<TimeRange, number> = {
  "24H": 300,
  "1W": 200,
  "1M": 200,
  "ALL": 400,
};

const RANGE_LOOKBACK_SEC: Record<TimeRange, number> = {
  "24H": 24 * 3600,
  "1W": 7 * 24 * 3600,
  "1M": 30 * 24 * 3600,
  "ALL": 365 * 24 * 3600,
};

// Step per titik di chart (time-based, bukan trade-based)
const CHART_STEP_SEC: Record<TimeRange, number> = {
  "24H": 10 * 60,  // 10 menit
  "1W": 30 * 60,   // 30 menit
  "1M": 2 * 3600,  // 2 jam
  "ALL": 6 * 3600, // 6 jam
};


function formatSol(lamports: number): string {
  const sol = lamports / 1e9;
  if (sol < 0.0001) return sol.toFixed(7);
  if (sol < 0.01) return sol.toFixed(5);
  if (sol < 1) return sol.toFixed(4);
  return sol.toFixed(3);
}

function formatPrice(solPerToken: number): string {
  if (solPerToken <= 0) return "0";
  if (solPerToken >= 1) return solPerToken.toFixed(3);
  if (solPerToken >= 0.001) return solPerToken.toFixed(5);
  // Hitung desimal berdasarkan magnitude → tampilkan 3 angka signifikan
  const exp = Math.floor(Math.log10(solPerToken));
  const decimals = Math.min(-exp + 2, 12);
  return solPerToken.toFixed(decimals).replace(/\.?0+$/, "") || "0";
}

function formatVolume(lamports: string): string {
  const sol = Number(lamports) / 1e9;
  if (sol >= 1_000_000) return `${(sol / 1_000_000).toFixed(1)}M`;
  if (sol >= 1_000) return `${(sol / 1_000).toFixed(1)}K`;
  return sol.toFixed(2);
}


export default function TokenDetail({ id }: { id: string }) {
  const identifier = decodeURIComponent(id);

  const [activeTab, setActiveTab] = useState<"trades" | "holders">("trades");
  const [tradeType, setTradeType] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("0.01");
  const [timeRange, setTimeRange] = useState<TimeRange>("24H");
  const [chartType, setChartType] = useState<ChartType>("line");
  const [copied, setCopied] = useState(false);
  const queryClient = useQueryClient();
  const { execute, status, error, reset } = useTradeAction();
  const { authenticated } = usePrivy();
  const { login } = useLogin();
  const { wallets } = useWallets();
  const walletAddress = wallets[0]?.address;

  const interval = RANGE_TO_INTERVAL[timeRange];
  const limit = RANGE_LIMIT[timeRange];
  const { data: market, isLoading: loadingMarket } = useMarketDetail(identifier);
  const { data: ohlcData, isLoading: loadingOHLC } = useOHLC(identifier, interval, limit);
  const { solBalance, tokenBalance } = useWalletBalance(walletAddress, market?.mint);

  useEffect(() => {
    if (status === "success") {
      queryClient.invalidateQueries({ queryKey: ["market", identifier] });
      queryClient.invalidateQueries({ queryKey: ["balance", "sol", walletAddress] });
      queryClient.invalidateQueries({ queryKey: ["balance", "token", walletAddress, market?.mint] });

      const t1 = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["ohlc", identifier] });
        queryClient.invalidateQueries({ queryKey: ["market", identifier] });
      }, 4000);

      const t2 = setTimeout(reset, 2000);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }
  }, [status, reset, queryClient, identifier, walletAddress, market?.mint]);

  const spotPrice = market
    ? ((Number(market.real_sol_reserves) + Number(market.base_virtual_sol)) /
        (Number(market.virtual_token_supply) - Number(market.tokens_minted))) /
      1e9
    : 0;

  const tokensMinted = market ? Number(market.tokens_minted) : 0;

  const chartColor = "#9C93E8";

  // Harga token dalam SOL per 1 token (human-readable, bukan raw)
  // spotPrice = lamports/raw_token / 1e9 = SOL per raw token
  // SOL per human token = SOL per raw token × 1e6  (1 token = 1e6 raw)
  const pricePerToken = spotPrice * 1e6;

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

    // Mulai dari candle pertama yang ada (bukan dari windowStart),
    // sehingga market baru yang baru 1 jam trading tetap keliatan volatile
    // meskipun time range-nya 24H.
    const from = sorted.length > 0
      ? Math.floor(sorted[0].time / step) * step
      : Math.floor(windowStart / step) * step;

    const result: { time: number; value: number }[] = [];
    let lastPrice = pricePerToken;
    let ci = 0;

    for (let t = from; t <= now; t += step) {
      while (ci < sorted.length && sorted[ci].time <= t) {
        lastPrice = sorted[ci].price;
        ci++;
      }
      result.push({ time: t, value: lastPrice });
    }

    return result;
  }, [ohlcData, pricePerToken, timeRange]);

  const candleData = useMemo(() => {
    if (!ohlcData?.candles?.length) return [];
    return ohlcData.candles.map((c) => ({
      time: Number(c.bucket ?? c.time),
      open: Number(c.open) / 1000,
      high: Number(c.high) / 1000,
      low: Number(c.low) / 1000,
      close: Number(c.close) / 1000,
    }));
  }, [ohlcData]);

  const mindshare = market ? market.current_mindshare_bps / 100 : 0;
  const ratchet = market ? market.ratchet_multiplier_bps / 10_000 : 0;
  const priceDeltaBps = market?.stats?.price_change_24h_bps ?? 0;
  const isPositive = priceDeltaBps >= 0;

  const label = market?.display_name ?? identifier;
  const ticker = identifier.includes(":") ? identifier.split(":")[1] : identifier;

  const TOKEN_DECIMALS = 1e6;
  const parsedAmount = parseFloat(amount || "0");
  // buy: amount is SOL → estimate tokens out; sell: amount is tokens → estimate SOL out
  // pricePerToken = SOL per human token (bukan per raw token)
  // buy:  SOL ÷ (SOL/token) = token
  // sell: token × (SOL/token) = SOL
  const estimatedOutput = pricePerToken > 0
    ? tradeType === "buy"
      ? `${(parsedAmount / pricePerToken).toFixed(2)} ${ticker}`
      : `${(parsedAmount * pricePerToken).toFixed(4)} SOL`
    : "—";

  function handleCopy() {
    navigator.clipboard.writeText(identifier);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (loadingMarket) {
    return (
      <div className="w-full max-w-7xl mx-auto pb-24 animate-pulse">
        <div className="h-8 w-48 bg-white/10 rounded mb-6" />
        <div className="h-64 bg-white/[0.03] rounded-xl" />
      </div>
    );
  }

  if (!market) {
    return (
      <div className="w-full max-w-7xl mx-auto pb-24 flex flex-col items-center justify-center py-32">
        <p className="text-white/40">Market not found: {identifier}</p>
        <Link href="/topics" className="mt-4 text-[#9C93E8] text-sm hover:underline">← Back to Topics</Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto pb-24 animate-fadeIn">
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <Link
          href="/topics"
          className="inline-flex items-center gap-1.5 text-white/40 hover:text-white/70 transition-colors text-sm mb-4"
        >
          <ArrowLeft size={13} />
          Home
        </Link>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-3xl sm:text-4xl font-bold text-white font-sans leading-tight truncate">
              {label}
            </h1>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-2 text-white/40 text-xs">
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 hover:text-white/70 transition-colors"
              >
                {identifier}
                <Copy size={10} />
              </button>
              {copied && <span className="text-[#9C93E8] text-[10px]">Copied!</span>}
            </div>
          </div>

          <div className="flex items-start justify-between shrink-0 lg:w-[340px]">
            <div className="flex flex-col">
              <span className="text-white font-mono font-bold text-base leading-snug">
                {formatVolume(market.stats.volume_24h_lamports)} SOL
              </span>
              <span className="text-white/30 text-[11px] mt-0.5">24h vol</span>
            </div>
            <div className="flex flex-col">
              <span
                className="font-mono font-bold text-base leading-snug"
                style={{ color: isPositive ? "#00FF47" : "#EF4444" }}
              >
                {isPositive ? "+" : ""}{(priceDeltaBps / 100).toFixed(2)}%
              </span>
              <span className="text-white/30 text-[11px] mt-0.5">24h change</span>
            </div>
            <div className="flex flex-col">
              <span className="text-white font-mono font-bold text-base leading-snug">
                {Number(market.stats?.holders_count ?? 0).toLocaleString()}
              </span>
              <span className="text-white/30 text-[11px] mt-0.5">holders</span>
            </div>
          </div>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left column */}
        <div className="flex-1 min-w-0 flex flex-col gap-6">
          {/* Chart */}
          <div className="w-full rounded-xl overflow-hidden relative" style={{ background: "#000", height: 320 }}>
            {loadingOHLC ? (
              <div className="w-full h-full animate-pulse bg-white/[0.03]" />
            ) : (
              <TradingViewChart
                lineData={lineData}
                candleData={candleData}
                chartType={chartType}
                color={chartColor}
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
                    timeRange === range ? "text-white font-semibold" : "text-white/25 hover:text-white/55"
                  }`}
                >
                  <div className="flex flex-col text-xs font-medium group-hover:-translate-y-1/2 transition-transform duration-300 ease-out">
                    <span className="block px-2.5 py-1">{range}</span>
                    <span className="block px-2.5 py-1" aria-hidden="true">{range}</span>
                  </div>
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setChartType("line")}
                className={`p-1.5 rounded transition-colors cursor-pointer ${chartType === "line" ? "text-white" : "text-white/25 hover:text-white/55"}`}
              >
                <TrendingUp size={15} />
              </button>
              <button
                onClick={() => setChartType("candle")}
                className={`p-1.5 rounded transition-colors cursor-pointer ${chartType === "candle" ? "text-white" : "text-white/25 hover:text-white/55"}`}
              >
                <BarChart2 size={15} />
              </button>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Spot Price", value: `${formatPrice(pricePerToken)} SOL` },
              { label: "24h Volume", value: `${formatVolume(market.stats.volume_24h_lamports)} SOL` },
              { label: "Mindshare", value: `${mindshare.toFixed(1)}%` },
              { label: "Holders", value: Number(market.stats?.holders_count ?? 0).toLocaleString() },
            ].map(({ label, value }) => (
              <div
                key={label}
                className="flex flex-col gap-1 bg-white/[0.02] border border-white/[0.06] rounded-xl px-4 py-3"
              >
                <span className="text-white/35 text-[11px] uppercase tracking-wide">{label}</span>
                <span className="font-mono text-sm text-white">{value}</span>
              </div>
            ))}
          </div>

          {/* Trades / Holders tabs */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-6 border-b border-white/[0.06]">
              {(["trades", "holders"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`h-8 overflow-hidden group relative transition-colors cursor-pointer ${
                    activeTab === tab ? "text-white" : "text-white/35 hover:text-white/65"
                  }`}
                >
                  <div className="flex flex-col text-sm font-medium capitalize group-hover:-translate-y-1/2 transition-transform duration-300 ease-out">
                    <span className="block pb-3">{tab}</span>
                    <span className="block pb-3" aria-hidden="true">{tab}</span>
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
                  {market.recent_trades.slice(0, 20).map((t) => (
                    <div
                      key={t.signature}
                      className="flex items-center justify-between px-4 py-2.5 bg-white/[0.02] border border-white/[0.05] rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded ${t.side === 0 ? "bg-[#22C55E]/10 text-[#22C55E]" : "bg-[#EF4444]/10 text-[#EF4444]"}`}>
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
                </div>
              ) : (
                <div className="w-full text-center py-10 text-white/30 text-sm border border-white/[0.06] rounded-xl bg-white/[0.015]">
                  No trades yet.
                </div>
              )
            ) : (
              market.holders && market.holders.length > 0 ? (
                <div className="flex flex-col gap-1">
                  {market.holders.map((h) => (
                    <div
                      key={h.trader}
                      className="flex items-center justify-between px-4 py-2.5 bg-white/[0.02] border border-white/[0.05] rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-[11px] text-white/30 w-5 text-right">#{h.rank}</span>
                        <span className="font-mono text-xs text-white/50">
                          {h.trader.slice(0, 6)}…{h.trader.slice(-4)}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-xs text-white/30">
                          {(h.share_bps / 100).toFixed(2)}%
                        </span>
                        <span className="font-mono text-xs text-white/70">
                          {(Number(h.net_tokens) / 1e6).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="w-full text-center py-10 text-white/30 text-sm border border-white/[0.06] rounded-xl bg-white/[0.015]">
                  No holders yet.
                </div>
              )
            )}
          </div>
        </div>

        {/* Right column: Trading panel */}
        <div className="w-full lg:w-[340px] shrink-0">
          <div
            className="border border-white/[0.08] rounded-xl p-5 flex flex-col gap-4 lg:sticky lg:top-20"
            style={{ background: "#000" }}
          >
            <div className="flex gap-5">
              {(["buy", "sell"] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setTradeType(type)}
                  className={`h-[26px] overflow-hidden group transition-colors cursor-pointer capitalize ${
                    tradeType === type
                      ? type === "buy"
                        ? "text-[#00FF47] border-b-2 border-[#00FF47]"
                        : "text-[#EF4444] border-b-2 border-[#EF4444]"
                      : "text-white/35 hover:text-white/65"
                  }`}
                >
                  <div className="flex flex-col text-base font-bold group-hover:-translate-y-1/2 transition-transform duration-300 ease-out">
                    <span className="block pb-0.5">{type.charAt(0).toUpperCase() + type.slice(1)}</span>
                    <span className="block pb-0.5" aria-hidden="true">{type.charAt(0).toUpperCase() + type.slice(1)}</span>
                  </div>
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between text-xs text-white/35">
              <span>Balance:</span>
              <span className="font-mono">
                {tradeType === "buy"
                  ? `${(solBalance / 1e9).toFixed(4)} SOL`
                  : `${(Number(tokenBalance) / 1e6).toLocaleString(undefined, { maximumFractionDigits: 2 })} ${ticker}`}
              </span>
            </div>

            <div
              className="flex items-center gap-2 border rounded-lg px-3 transition-colors focus-within:border-white/30"
              style={{ borderColor: "rgba(255,255,255,0.12)" }}
            >
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="flex-1 bg-transparent py-3 text-white font-mono text-base outline-none placeholder-white/20 min-w-0"
              />
              <span className="text-white/40 text-sm font-mono shrink-0 transition-all duration-200">
                {tradeType === "buy" ? "SOL" : ticker}
              </span>
            </div>

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
                  className="h-8 overflow-hidden group text-white/45 bg-white/[0.05] hover:bg-white/[0.09] rounded-lg transition-colors cursor-pointer"
                >
                  <div className="flex flex-col text-xs font-medium group-hover:-translate-y-1/2 transition-transform duration-300 ease-out">
                    <span className="block py-2">{pct}%</span>
                    <span className="block py-2" aria-hidden="true">{pct}%</span>
                  </div>
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between py-1 text-sm">
              <span className="text-white/60 font-mono">{estimatedOutput}</span>
              <span className="text-white/30 text-xs">estimated</span>
            </div>

            {error && (
              <p className="text-[#EF4444] text-xs text-center -mt-1">{error}</p>
            )}
            {!authenticated ? (
              <button
                onClick={() => login()}
                className="w-full h-[50px] rounded-xl font-bold text-sm bg-white/10 text-white hover:bg-white/15 transition-all cursor-pointer border border-white/10"
              >
                Connect Wallet
              </button>
            ) : (
              <button
                disabled={status === "preparing" || status === "signing" || status === "success"}
                onClick={() => {
                  if (tradeType === "buy") {
                    execute({ identifier, side: "buy", solAmount: parsedAmount || 0.01 });
                  } else {
                    execute({ identifier, side: "sell", tokenAmount: String(Math.floor(parsedAmount * TOKEN_DECIMALS)) });
                  }
                }}
                className={`w-full h-[50px] overflow-hidden rounded-xl font-bold text-sm transition-all cursor-pointer disabled:cursor-not-allowed ${
                  status === "success"
                    ? "bg-white/10 text-white/60"
                    : tradeType === "buy"
                      ? "bg-[#00FF47] text-black hover:brightness-110"
                      : "bg-[#EF4444] text-black hover:brightness-110"
                }`}
              >
                <div className={`flex flex-col transition-transform duration-300 ease-out ${status === "success" ? "-translate-y-1/2" : ""}`}>
                  <span className="flex items-center justify-center h-[50px]">
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
    </div>
  );
}
