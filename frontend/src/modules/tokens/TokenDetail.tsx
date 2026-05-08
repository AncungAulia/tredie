"use client";
import React, { useState, useMemo, useEffect, useRef, useId } from "react";
import { useMarketDetail } from "@/hooks/useMarketDetail";
import { useOHLC } from "@/hooks/useOHLC";
import { useTradeAction } from "@/hooks/useTradeAction";
import { useWalletBalance } from "@/hooks/useWalletBalance";
import { usePrivy } from "@privy-io/react-auth";
import { useWallets } from "@privy-io/react-auth/solana";
import { estimateTrade, type EstimateResult } from "@/lib/api/trade";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Copy, BarChart2, TrendingUp, Loader2 } from "lucide-react";
import Link from "next/link";
import {
  ResponsiveContainer,
  ComposedChart,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  Customized,
} from "recharts";
import type { OHLCInterval } from "@/types/api";

type TimeRange = "1H" | "6H" | "24H" | "1W" | "1M" | "ALL";
type ChartType = "line" | "candle";

const TIME_RANGES: TimeRange[] = ["1H", "6H", "24H", "1W", "1M", "ALL"];

const RANGE_TO_INTERVAL: Record<TimeRange, OHLCInterval> = {
  "1H": "5m",
  "6H": "15m",
  "24H": "1h",
  "1W": "4h",
  "1M": "1d",
  "ALL": "1d",
};

const TOKEN_DECIMALS = 6;

function CustomDot(props: {
  cx?: number;
  cy?: number;
  index?: number;
  dataLength: number;
  color: string;
}) {
  const { cx, cy, index, dataLength, color } = props;
  if (index !== dataLength - 1 || cx === undefined || cy === undefined) return null;
  return (
    <g>
      <circle cx={cx} cy={cy} r={7} fill={color} fillOpacity={0.2} />
      <circle cx={cx} cy={cy} r={4} fill={color} />
    </g>
  );
}

function formatSol(lamports: number): string {
  const sol = lamports / 1e9;
  if (sol < 0.0001) return sol.toFixed(7);
  if (sol < 0.01) return sol.toFixed(5);
  if (sol < 1) return sol.toFixed(4);
  return sol.toFixed(3);
}

function formatSpotPrice(lamportsPerToken: number): string {
  const sol = lamportsPerToken / 1e9;
  if (sol === 0) return "0";
  if (sol >= 0.01) return sol.toFixed(4);
  if (sol >= 0.0001) return sol.toFixed(6);
  if (sol >= 0.000001) return sol.toFixed(8);
  return sol.toFixed(20).replace(/\.?0+$/, "") || "0";
}

function formatVolume(lamports: string): string {
  const sol = Number(lamports) / 1e9;
  if (sol >= 1_000_000) return `${(sol / 1_000_000).toFixed(1)}M`;
  if (sol >= 1_000) return `${(sol / 1_000).toFixed(1)}K`;
  return sol.toFixed(2);
}

function formatTokens(raw: string): string {
  const n = Number(raw) / 10 ** TOKEN_DECIMALS;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(2)}K`;
  return n.toFixed(2);
}

function formatTime(unixSeconds: number, interval: OHLCInterval): string {
  const d = new Date(unixSeconds * 1000);
  if (interval === "5m" || interval === "15m") {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  if (interval === "1h" || interval === "4h") {
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  }
  return d.toLocaleDateString([], { month: "short", year: "2-digit" });
}

function CandlestickLayer({ xAxisMap, yAxisMap, data }: any) {
  const uid = useId().replace(/:/g, "");
  if (!xAxisMap || !yAxisMap) return null;
  const xAxis = Object.values(xAxisMap as Record<string, any>)[0] as any;
  const yAxis = Object.values(yAxisMap as Record<string, any>)[0] as any;
  if (!xAxis?.scale || !yAxis?.scale) return null;

  const xScale = xAxis.scale;
  const bandwidth: number = xScale.bandwidth ? xScale.bandwidth() : 8;
  const barW = Math.max(2, bandwidth * 0.55);
  const [xMin, xMax] = xScale.range ? xScale.range() : [0, 800];
  const [yBottom, yTop] = yAxis.scale.range ? yAxis.scale.range() : [200, 0];
  const totalW = xMax - xMin;
  const totalH = Math.abs(yBottom - yTop);
  const yOrigin = Math.min(yTop, yBottom);

  return (
    <g>
      <defs>
        <clipPath id={`cc-${uid}`}>
          <rect x={xMin} y={yOrigin - 10} width={0} height={totalH + 20}>
            <animate
              attributeName="width"
              from="0"
              to={String(totalW)}
              dur="0.6s"
              calcMode="spline"
              keySplines="0.22 1 0.36 1"
              keyTimes="0;1"
              fill="freeze"
            />
          </rect>
        </clipPath>
      </defs>
      <g clipPath={`url(#cc-${uid})`}>
        {(data as any[]).map((d, i) => {
          if (d.open == null) return null;
          const cx: number = (xScale(d.time) ?? 0) + bandwidth / 2;
          const yO: number = yAxis.scale(d.open);
          const yC: number = yAxis.scale(d.close);
          const yH: number = yAxis.scale(d.high);
          const yL: number = yAxis.scale(d.low);
          const isUp = d.close >= d.open;
          const color = isUp ? "#22C55E" : "#EF4444";
          return (
            <g key={i}>
              <line x1={cx} y1={yH} x2={cx} y2={yL} stroke={color} strokeWidth={1} strokeOpacity={0.7} />
              <rect
                x={cx - barW / 2}
                y={Math.min(yO, yC)}
                width={barW}
                height={Math.max(1, Math.abs(yC - yO))}
                fill={color}
              />
            </g>
          );
        })}
      </g>
    </g>
  );
}


const SLIPPAGE_OPTIONS = [50, 100, 200, 500] as const;
type SlippageBps = (typeof SLIPPAGE_OPTIONS)[number];

export default function TokenDetail({ id }: { id: string }) {
  const identifier = decodeURIComponent(id);
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<"trades" | "holders">("trades");
  const [tradeType, setTradeType] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("0.01");
  const [slippageBps, setSlippageBps] = useState<SlippageBps>(100);
  const [showSlippage, setShowSlippage] = useState(false);
  const [timeRange, setTimeRange] = useState<TimeRange>("24H");
  const [chartType, setChartType] = useState<ChartType>("line");
  const [copied, setCopied] = useState(false);
  const [estimate, setEstimate] = useState<EstimateResult | null>(null);
  const [estimating, setEstimating] = useState(false);
  const estimateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [chartMounted, setChartMounted] = useState(false);
  const [hoveredTime, setHoveredTime] = useState<string | null>(null);

  const interval = RANGE_TO_INTERVAL[timeRange];
  const { data: market, isLoading: loadingMarket } = useMarketDetail(identifier);
  const { data: ohlcData, isLoading: loadingOHLC } = useOHLC(identifier, interval);

  const { ready: privyReady, authenticated } = usePrivy();
  const { wallets: solanaWallets } = useWallets();
  const connectedAddress = solanaWallets[0]?.address;
  const isConnected = privyReady && authenticated && !!connectedAddress;

  useEffect(() => { setChartMounted(true); }, []);

  const { execute, status: tradeStatus, error: tradeError, reset: resetTrade } = useTradeAction();
  const { solBalance, tokenBalance, refetchBalances } = useWalletBalance(
    connectedAddress,
    market?.mint,
  );

  // Debounced estimate whenever amount or tradeType changes
  useEffect(() => {
    if (estimateTimer.current) clearTimeout(estimateTimer.current);

    const amountNum = parseFloat(amount);
    if (!amount || isNaN(amountNum) || amountNum <= 0) {
      setEstimate(null);
      return;
    }

    setEstimating(true);
    estimateTimer.current = setTimeout(async () => {
      try {
        if (tradeType === "buy") {
          const result = await estimateTrade({
            identifier,
            side: "buy",
            solAmount: amountNum,
            slippageBps,
          });
          setEstimate(result);
        } else {
          // For sell, amount is in human token units — convert to base units
          const rawTokens = BigInt(Math.floor(amountNum * 10 ** TOKEN_DECIMALS)).toString();
          const result = await estimateTrade({
            identifier,
            side: "sell",
            tokenAmount: rawTokens,
            slippageBps,
          });
          setEstimate(result);
        }
      } catch {
        setEstimate(null);
      } finally {
        setEstimating(false);
      }
    }, 500);

    return () => {
      if (estimateTimer.current) clearTimeout(estimateTimer.current);
    };
  }, [amount, tradeType, identifier, slippageBps]);

  // After successful trade: refresh market data + balances
  useEffect(() => {
    if (tradeStatus === "success") {
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["market", identifier] });
        queryClient.invalidateQueries({ queryKey: ["ohlc", identifier] });
        refetchBalances();
      }, 2000); // small delay for webhook to process
    }
  }, [tradeStatus, identifier, queryClient, refetchBalances]);

  const holders = useMemo(() => {
    if (!market) return [];
    const map = new Map<string, { bought: bigint; sold: bigint; solSpent: bigint }>();
    for (const t of market.recent_trades) {
      const entry = map.get(t.trader) ?? { bought: BigInt(0), sold: BigInt(0), solSpent: BigInt(0) };
      if (t.side === 0) {
        entry.bought += BigInt(t.token_amount);
        entry.solSpent += BigInt(t.sol_amount);
      } else {
        entry.sold += BigInt(t.token_amount);
      }
      map.set(t.trader, entry);
    }
    return Array.from(map.entries())
      .map(([address, { bought, sold, solSpent }]) => ({
        address,
        netTokens: bought - sold,
        solSpent,
      }))
      .filter((h) => h.netTokens > BigInt(0))
      .sort((a, b) => (b.netTokens > a.netTokens ? 1 : -1));
  }, [market]);

  const spotPrice = market
    ? ((Number(market.real_sol_reserves) + Number(market.base_virtual_sol)) /
        (Number(market.virtual_token_supply) - Number(market.tokens_minted))) /
      1e9
    : 0;

  const candleChartData = useMemo(() => {
    if (!ohlcData?.candles?.length) return [];
    return ohlcData.candles.map((c) => ({
      time: formatTime(c.time, interval),
      open: c.open / 1e9,
      high: c.high / 1e9,
      low: c.low / 1e9,
      close: c.close / 1e9,
      price: c.close / 1e9,
    }));
  }, [ohlcData, interval]);

  const intervalSeconds: Record<OHLCInterval, number> = {
    "5m": 300, "15m": 900, "1h": 3600, "4h": 14400, "1d": 86400,
  };

  const chartData = useMemo(() => {
    const nowSec = Math.floor(Date.now() / 1000);
    const stepSec = intervalSeconds[interval];

    if (!ohlcData?.candles?.length) {
      const p = spotPrice > 0 ? spotPrice : 0;
      return [
        { time: formatTime(nowSec - stepSec, interval), price: p },
        { time: formatTime(nowSec, interval), price: p },
      ];
    }
    const points = ohlcData.candles.map((c) => ({
      time: formatTime(Number(c.time), interval),
      price: c.close / 1e9,
    }));
    if (points.length === 1) {
      const firstSec = Number(ohlcData.candles[0].time);
      return [
        { time: formatTime(firstSec - stepSec, interval), price: points[0].price },
        ...points,
      ];
    }
    return points;
  }, [ohlcData, spotPrice, interval]);

  const chartColor = "#9C93E8";
  const lastPrice = chartData[chartData.length - 1]?.price ?? 0;

  const marketCapSol = market ? Number(market.real_sol_reserves) / 1e9 : 0;

  const mindshare = market ? market.current_mindshare_bps / 100 : 0;
  const ratchet = market ? market.ratchet_multiplier_bps / 10_000 : 0;
  const priceDeltaBps = market?.stats?.price_change_24h_bps ?? 0;
  const isPositive = priceDeltaBps >= 0;

  const label = market?.display_name ?? identifier;
  const ticker = identifier.includes(":") ? identifier.split(":")[1] : identifier;

  const solBalanceSol = solBalance / 1e9;
  const tokenBalanceHuman = Number(tokenBalance) / 10 ** TOKEN_DECIMALS;

  function handleAmountPercent(pct: number) {
    if (tradeType === "buy") {
      const sol = ((pct / 100) * solBalanceSol).toFixed(4);
      setAmount(sol);
    } else {
      const tokens = ((pct / 100) * tokenBalanceHuman).toFixed(TOKEN_DECIMALS);
      setAmount(tokens);
    }
  }

  async function handleTrade() {
    if (!isConnected) return;
    resetTrade();

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) return;

    let params: Parameters<typeof execute>[0];
    if (tradeType === "buy") {
      params = { identifier, side: "buy", solAmount: amountNum, slippageBps };
    } else {
      const rawTokens = BigInt(Math.floor(amountNum * 10 ** TOKEN_DECIMALS)).toString();
      params = { identifier, side: "sell", tokenAmount: rawTokens, slippageBps };
    }

    await execute(params);
  }

  function handleCopy() {
    navigator.clipboard.writeText(identifier);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const isBusy = tradeStatus === "preparing" || tradeStatus === "signing";

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
        <Link href="/trends" className="mt-4 text-[#9C93E8] text-sm hover:underline">
          ← Back to Trends
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto pb-24 animate-fadeIn">
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <Link
          href="/trends"
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
              <span>•</span>
              <span className="text-white/50">Bonding curve</span>
              <div className="flex items-center gap-1.5">
                <div className="w-14 h-1 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min(mindshare, 100)}%`,
                      backgroundColor: "#9C93E8",
                    }}
                  />
                </div>
                <span className="text-[11px] font-mono font-semibold text-[#9C93E8]">
                  {mindshare.toFixed(1)}%
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-start gap-6 sm:gap-8 shrink-0">
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
                {isPositive ? "+" : ""}
                {(priceDeltaBps / 100).toFixed(2)}%
              </span>
              <span className="text-white/30 text-[11px] mt-0.5">24h change</span>
            </div>
            <div className="flex flex-col">
              <span className="text-white font-mono font-bold text-base leading-snug">
                {marketCapSol.toFixed(2)} SOL
              </span>
              <span className="text-white/30 text-[11px] mt-0.5">mkt cap</span>
            </div>
          </div>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left column */}
        <div className="flex-1 min-w-0 flex flex-col gap-6">
          {/* Chart */}
          <div
            className="w-full rounded-xl overflow-hidden relative"
            style={{ background: "#000", height: 280 }}
          >
            {loadingOHLC ? (
              <div className="w-full h-full animate-pulse bg-white/[0.03]" />
            ) : !chartMounted ? null : chartType === "candle" && candleChartData.length >= 1 ? (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={candleChartData}
                  margin={{ top: 24, right: 0, left: 0, bottom: 0 }}
                  onMouseMove={(state: any) => {
                    if (state?.activePayload?.length) setHoveredTime(state.activePayload[0].payload.time);
                  }}
                  onMouseLeave={() => setHoveredTime(null)}
                >
                  <XAxis dataKey="time" hide />
                  <YAxis
                    hide
                    domain={[
                      (min: number) => min - Math.abs(min) * 0.08,
                      (max: number) => max + Math.abs(max) * 0.08,
                    ]}
                  />
                  <Tooltip
                    cursor={{ stroke: "rgba(255,255,255,0.15)", strokeWidth: 1 }}
                    content={() => null}
                  />
                  <Area dataKey="price" stroke="none" fill="none" dot={false} activeDot={false} legendType="none" isAnimationActive={false} />
                  <Customized component={CandlestickLayer} />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={chartData}
                  margin={{ top: 24, right: 0, left: 0, bottom: 0 }}
                  onMouseMove={(state: any) => {
                    if (state?.activePayload?.length) setHoveredTime(state.activePayload[0].payload.time);
                  }}
                  onMouseLeave={() => setHoveredTime(null)}
                >
                  <defs>
                    <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={chartColor} stopOpacity={0.18} />
                      <stop offset="100%" stopColor={chartColor} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="time" hide />
                  <YAxis
                    hide
                    domain={[
                      (min: number) => min - Math.abs(min) * 0.08,
                      (max: number) => max + Math.abs(max) * 0.08,
                    ]}
                  />
                  <Tooltip
                    cursor={{ stroke: "rgba(255,255,255,0.15)", strokeWidth: 1 }}
                    content={() => null}
                  />
                  <ReferenceLine
                    y={lastPrice}
                    stroke={chartColor}
                    strokeDasharray="4 4"
                    strokeOpacity={0.35}
                    strokeWidth={1}
                  />
                  <Area
                    type="monotone"
                    dataKey="price"
                    stroke={chartColor}
                    strokeWidth={2}
                    fill="url(#areaGradient)"
                    dot={(props: any) => (
                      <CustomDot
                        key={`dot-${props.index}`}
                        cx={props.cx}
                        cy={props.cy}
                        index={props.index}
                        dataLength={chartData.length}
                        color={chartColor}
                      />
                    )}
                    activeDot={{ r: 5, fill: chartColor, stroke: "#000", strokeWidth: 2 }}
                    isAnimationActive
                    animationBegin={0}
                    animationDuration={700}
                    animationEasing="ease-out"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Hover timestamp */}
          <div className="h-5 flex items-center justify-center">
            <span
              className="text-white/40 text-[11px] font-mono transition-opacity duration-100"
              style={{ opacity: hoveredTime ? 1 : 0 }}
            >
              {hoveredTime ?? ""}
            </span>
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
          <div className="grid grid-cols-3 gap-3">
            {[
              {
                label: "Spot Price",
                value: `${formatSpotPrice(market.stats.spot_price_lamports_per_token)} SOL`,
              },
              { label: "24h Volume", value: `${formatVolume(market.stats.volume_24h_lamports)} SOL` },
              { label: "Mkt Cap", value: `${marketCapSol >= 1000 ? `${(marketCapSol / 1000).toFixed(1)}K` : marketCapSol.toFixed(2)} SOL` },
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

          {/* Ratchet status */}
          <div className="flex items-center justify-between bg-[rgba(156,147,232,0.07)] border border-[rgba(156,147,232,0.15)] rounded-xl px-4 py-3">
            <div className="flex flex-col gap-0.5">
              <span className="text-white/40 text-[11px] uppercase tracking-wide">
                Ratchet Status
              </span>
              <span className="text-[#9C93E8] font-semibold text-sm">Price floor boosted</span>
            </div>
            <span className="text-[#9C93E8] font-mono font-bold text-sm bg-[rgba(156,147,232,0.15)] px-3 py-1 rounded-md">
              {ratchet.toFixed(1)}x
            </span>
          </div>

          {/* Trades / Holders tabs */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-6 border-b border-white/[0.06]">
              {([
                { key: "trades", label: `Trades (${market.recent_trades.length})` },
                { key: "holders", label: `Holders (${holders.length})` },
              ] as const).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={`h-8 overflow-hidden group relative transition-colors cursor-pointer ${
                    activeTab === key ? "text-white" : "text-white/35 hover:text-white/65"
                  }`}
                >
                  <div className="flex flex-col text-sm font-medium group-hover:-translate-y-1/2 transition-transform duration-300 ease-out">
                    <span className="block pb-3">{label}</span>
                    <span className="block pb-3" aria-hidden="true">{label}</span>
                  </div>
                  {activeTab === key && (
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
                        <span
                          className={`text-[11px] font-bold px-1.5 py-0.5 rounded ${t.side === 0 ? "bg-[#22C55E]/10 text-[#22C55E]" : "bg-[#EF4444]/10 text-[#EF4444]"}`}
                        >
                          {t.side === 0 ? "BUY" : "SELL"}
                        </span>
                        <span className="font-mono text-xs text-white/50">
                          {t.trader.slice(0, 6)}…{t.trader.slice(-4)}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-xs text-white/40">
                          {formatTokens(t.token_amount)} {ticker}
                        </span>
                        <span className="font-mono text-xs text-white/70">
                          {formatSol(Number(t.sol_amount))} SOL
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="w-full text-center py-10 text-white/30 text-sm border border-white/[0.06] rounded-xl bg-white/[0.015]">
                  No trades yet.
                </div>
              )
            ) : (
              holders.length > 0 ? (
                <div className="flex flex-col gap-1">
                  {holders.map((h, i) => (
                    <div
                      key={h.address}
                      className="flex items-center justify-between px-4 py-2.5 bg-white/[0.02] border border-white/[0.05] rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-white/25 text-[11px] font-mono w-5 text-right">{i + 1}</span>
                        <span className="font-mono text-xs text-white/50">
                          {h.address.slice(0, 6)}…{h.address.slice(-4)}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-xs text-white/70">
                          {formatTokens(h.netTokens.toString())} {ticker}
                        </span>
                        <span className="font-mono text-xs text-white/30">
                          {formatSol(Number(h.solSpent))} SOL in
                        </span>
                      </div>
                    </div>
                  ))}
                  <p className="text-[10px] text-white/20 text-center pt-2">
                    Derived from last {market.recent_trades.length} trades
                  </p>
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
            {/* Buy / Sell toggle */}
            <div className="flex gap-5">
              {(["buy", "sell"] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => {
                    setTradeType(type);
                    setAmount(type === "buy" ? "0.01" : "0");
                    setEstimate(null);
                    resetTrade();
                  }}
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

              {/* Slippage control */}
              <div className="ml-auto relative">
                <button
                  onClick={() => setShowSlippage((v) => !v)}
                  className="text-[11px] text-white/30 hover:text-white/60 font-mono transition-colors"
                >
                  slip {(slippageBps / 100).toFixed(0)}%
                </button>
                {showSlippage && (
                  <div className="absolute right-0 top-6 z-10 bg-[#0d0d0d] border border-white/10 rounded-lg p-2 flex gap-1.5 shadow-xl">
                    {SLIPPAGE_OPTIONS.map((bps) => (
                      <button
                        key={bps}
                        onClick={() => {
                          setSlippageBps(bps);
                          setShowSlippage(false);
                        }}
                        className={`px-2.5 py-1 rounded text-[11px] font-mono transition-colors ${
                          slippageBps === bps
                            ? "bg-[rgba(156,147,232,0.2)] text-[#9C93E8]"
                            : "text-white/40 hover:text-white/70"
                        }`}
                      >
                        {(bps / 100).toFixed(0)}%
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Balance row */}
            <div className="flex items-center justify-between text-xs text-white/35">
              {tradeType === "buy" ? (
                <>
                  <span>Balance</span>
                  <span className="font-mono">
                    {isConnected ? `${solBalanceSol.toFixed(4)} SOL` : "—"}
                  </span>
                </>
              ) : (
                <>
                  <span>Holdings</span>
                  <span className="font-mono">
                    {isConnected ? `${tokenBalanceHuman.toFixed(2)} ${ticker}` : "—"}
                  </span>
                </>
              )}
            </div>

            {/* Amount input */}
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
              <span className="text-white/40 text-sm font-mono shrink-0">
                {tradeType === "buy" ? "SOL" : ticker}
              </span>
            </div>

            {/* Percentage buttons */}
            <div className="grid grid-cols-4 gap-2">
              {[25, 50, 75, 100].map((pct) => (
                <button
                  key={pct}
                  onClick={() => handleAmountPercent(pct)}
                  className="h-8 overflow-hidden group text-white/45 bg-white/[0.05] hover:bg-white/[0.09] rounded-lg transition-colors cursor-pointer"
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

            {/* Estimate row */}
            <div className="flex items-center justify-between py-1 text-sm min-h-[28px]">
              {estimating ? (
                <span className="text-white/25 text-xs font-mono animate-pulse">estimating…</span>
              ) : estimate ? (
                <>
                  <span className="text-white/60 font-mono text-xs">
                    {tradeType === "buy" && estimate.output.tokensOut
                      ? `~${formatTokens(estimate.output.tokensOut)} ${ticker}`
                      : tradeType === "sell" && estimate.output.solOut
                        ? `~${formatSol(Number(estimate.output.solOut))} SOL`
                        : "—"}
                  </span>
                  <span className="text-white/25 text-[10px] font-mono">
                    impact {((estimate.price.impactBps ?? 0) / 100).toFixed(2)}%
                  </span>
                </>
              ) : (
                <span className="text-white/20 text-xs font-mono">enter amount to estimate</span>
              )}
            </div>

            {/* Trade status feedback */}
            {tradeStatus === "success" && (
              <div className="bg-[#22C55E]/10 border border-[#22C55E]/20 rounded-lg px-3 py-2 text-[#22C55E] text-xs font-mono">
                Trade confirmed! Chart updates in ~10s.
              </div>
            )}
            {tradeStatus === "error" && tradeError && (
              <div className="bg-[#EF4444]/10 border border-[#EF4444]/20 rounded-lg px-3 py-2 text-[#EF4444] text-xs font-mono break-words">
                {tradeError}
              </div>
            )}

            {/* CTA button */}
            {!isConnected ? (
              <div className="w-full py-3.5 rounded-xl font-bold text-sm text-center text-white/30 bg-white/[0.04] border border-white/[0.07]">
                Connect wallet to trade
              </div>
            ) : (
              <button
                onClick={handleTrade}
                disabled={isBusy || tradeStatus === "success"}
                className={`w-full py-3.5 rounded-xl font-bold text-sm transition-all cursor-pointer flex items-center justify-center gap-2 ${
                  tradeType === "buy"
                    ? "bg-[#00FF47] text-black hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
                    : "bg-white/[0.07] text-white hover:bg-white/[0.12] disabled:opacity-50 disabled:cursor-not-allowed"
                }`}
              >
                {isBusy && <Loader2 size={14} className="animate-spin" />}
                {tradeStatus === "preparing"
                  ? "Preparing…"
                  : tradeStatus === "signing"
                    ? "Sign in wallet…"
                    : tradeStatus === "success"
                      ? "Done!"
                      : `${tradeType === "buy" ? "Buy" : "Sell"} ${ticker}`}
              </button>
            )}

            {tradeStatus !== "idle" && tradeStatus !== "success" ? null : (
              tradeStatus === "success" ? (
                <button
                  onClick={() => {
                    resetTrade();
                    setAmount(tradeType === "buy" ? "0.01" : "0");
                    setEstimate(null);
                  }}
                  className="text-[11px] text-white/30 hover:text-white/60 text-center transition-colors"
                >
                  Trade again
                </button>
              ) : null
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
