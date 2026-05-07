"use client";
import React, { useState } from "react";
import { useMarketStore } from "@/store/useMarketStore";
import { ArrowLeft, Copy, BarChart2, TrendingUp } from "lucide-react";
import Link from "next/link";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
} from "recharts";

type TimeRange = "1H" | "6H" | "24H" | "1W" | "1M" | "3M" | "1Y" | "ALL";
type ChartType = "line" | "candle";

const TIME_RANGES: TimeRange[] = [
  "1H",
  "6H",
  "24H",
  "1W",
  "1M",
  "3M",
  "1Y",
  "ALL",
];

const CHART_DATA_BY_RANGE: Record<
  TimeRange,
  { time: string; price: number }[]
> = {
  "1H": [
    { time: "0m", price: 0.044 },
    { time: "15m", price: 0.045 },
    { time: "30m", price: 0.046 },
    { time: "45m", price: 0.047 },
    { time: "60m", price: 0.045 },
  ],
  "6H": [
    { time: "0h", price: 0.04 },
    { time: "1h", price: 0.042 },
    { time: "2h", price: 0.041 },
    { time: "3h", price: 0.044 },
    { time: "4h", price: 0.046 },
    { time: "5h", price: 0.045 },
    { time: "6h", price: 0.047 },
  ],
  "24H": [
    { time: "0h", price: 0.038 },
    { time: "4h", price: 0.04 },
    { time: "8h", price: 0.042 },
    { time: "12h", price: 0.041 },
    { time: "16h", price: 0.045 },
    { time: "20h", price: 0.048 },
    { time: "24h", price: 0.045 },
  ],
  "1W": [
    { time: "Mon", price: 0.032 },
    { time: "Tue", price: 0.035 },
    { time: "Wed", price: 0.038 },
    { time: "Thu", price: 0.036 },
    { time: "Fri", price: 0.041 },
    { time: "Sat", price: 0.044 },
    { time: "Sun", price: 0.045 },
  ],
  "1M": [
    { time: "W1", price: 0.025 },
    { time: "W2", price: 0.03 },
    { time: "W3", price: 0.038 },
    { time: "W4", price: 0.045 },
  ],
  "3M": [
    { time: "Jan", price: 0.02 },
    { time: "Feb", price: 0.03 },
    { time: "Mar", price: 0.045 },
  ],
  "1Y": [
    { time: "Q1", price: 0.01 },
    { time: "Q2", price: 0.018 },
    { time: "Q3", price: 0.032 },
    { time: "Q4", price: 0.045 },
  ],
  ALL: [
    { time: "2023", price: 0.005 },
    { time: "2024", price: 0.018 },
    { time: "2025", price: 0.045 },
  ],
};

function CustomDot(props: {
  cx?: number;
  cy?: number;
  index?: number;
  dataLength: number;
  color: string;
}) {
  const { cx, cy, index, dataLength, color } = props;
  if (index !== dataLength - 1 || cx === undefined || cy === undefined)
    return null;
  return (
    <g>
      <circle cx={cx} cy={cy} r={7} fill={color} fillOpacity={0.2} />
      <circle cx={cx} cy={cy} r={4} fill={color} />
    </g>
  );
}

export default function TokenDetail({ id }: { id: string }) {
  const { markets } = useMarketStore();
  const market = markets.find((m) => m.id === id) || markets[0];
  const [activeTab, setActiveTab] = useState<"trades" | "holders">("trades");
  const [tradeType, setTradeType] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("0.01");
  const [timeRange, setTimeRange] = useState<TimeRange>("24H");
  const [chartType, setChartType] = useState<ChartType>("line");
  const [copied, setCopied] = useState(false);

  const isPositive = market.priceDelta >= 0;
  const chartColor = "#9C93E8";
  const chartData = CHART_DATA_BY_RANGE[timeRange];
  const lastPrice = chartData[chartData.length - 1].price;
  const ticker = market.ticker.split(":")[1];

  function handleCopy() {
    navigator.clipboard.writeText(market.ticker);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function handlePct(pct: number) {
    setAmount((pct * 0.001).toFixed(4));
  }

  const estimatedTokens = (parseFloat(amount || "0") / lastPrice).toFixed(2);

  return (
    <div className="w-full max-w-7xl mx-auto pb-24 animate-fadeIn">
      {/* ── Header ───────────────────────────────────── */}
      <div className="mb-6 sm:mb-8">
        <Link
          href="/topics"
          className="inline-flex items-center gap-1.5 text-white/40 hover:text-white/70 transition-colors text-sm mb-4"
        >
          <ArrowLeft size={13} />
          Home
        </Link>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          {/* Name + metadata */}
          <div className="min-w-0">
            <h1 className="text-3xl sm:text-4xl font-bold text-white font-sans leading-tight truncate">
              {market.name}
            </h1>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-2 text-white/40 text-xs">
              {market.ticker}

              <span>•</span>
              <span className="text-white/50">Bonding curve</span>
              <div className="flex items-center gap-1.5">
                <div className="w-14 h-1 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min(market.mindshare, 100)}%`,
                      backgroundColor: "#9C93E8",
                    }}
                  />
                </div>
                <span className="text-[11px] font-mono font-semibold text-[#9C93E8]">
                  {market.mindshare}%
                </span>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="flex items-start gap-6 sm:gap-8 shrink-0">
            <div className="flex flex-col">
              <span className="text-white font-mono font-bold text-base leading-snug">
                ${(market.marketCap / 1000).toFixed(2)}K
              </span>
              <span className="text-white/30 text-[11px] mt-0.5">mcap</span>
            </div>
            <div className="flex flex-col">
              <span
                className="font-mono font-bold text-base leading-snug"
                style={{ color: isPositive ? "#00FF47" : "#EF4444" }}
              >
                {isPositive ? "+" : ""}
                {market.priceDelta.toFixed(2)}%
              </span>
              <span className="text-white/30 text-[11px] mt-0.5">
                24h change
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-white font-mono font-bold text-base leading-snug">
                ${(market.volume24h / 1000000).toFixed(2)}M
              </span>
              <span className="text-white/30 text-[11px] mt-0.5">
                24h volume
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Two-column layout ─────────────────────────── */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left column */}
        <div className="flex-1 min-w-0 flex flex-col gap-6">
          {/* Chart */}
          <div
            className="w-full rounded-xl overflow-hidden relative"
            style={{ background: "#000", height: 280 }}
          >
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={chartData}
                margin={{ top: 24, right: 0, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="0%"
                      stopColor={chartColor}
                      stopOpacity={0.18}
                    />
                    <stop
                      offset="100%"
                      stopColor={chartColor}
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <XAxis dataKey="time" hide />
                <YAxis hide domain={["auto", "auto"]} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0a0a0a",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: "6px",
                    padding: "6px 10px",
                  }}
                  itemStyle={{ color: "#fff", fontSize: 12 }}
                  labelStyle={{ color: "rgba(255,255,255,0.35)", fontSize: 11 }}
                  formatter={(val) => [`$${Number(val).toFixed(4)}`, "Price"]}
                />
                <ReferenceLine
                  y={lastPrice}
                  stroke={chartColor}
                  strokeDasharray="4 4"
                  strokeOpacity={0.35}
                  strokeWidth={1}
                />
                <Area
                  type="linear"
                  dataKey="price"
                  stroke={chartColor}
                  strokeWidth={2}
                  fill="url(#areaGradient)"
                  dot={(props) => (
                    <CustomDot
                      key={`dot-${props.index}`}
                      cx={props.cx}
                      cy={props.cy}
                      index={props.index}
                      dataLength={chartData.length}
                      color={chartColor}
                    />
                  )}
                  activeDot={{ r: 4, fill: chartColor, stroke: "transparent" }}
                  isAnimationActive={true}
                />
              </AreaChart>
            </ResponsiveContainer>
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
                    <span className="block px-2.5 py-1" aria-hidden="true">{range}</span>
                  </div>
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setChartType("line")}
                className={`p-1.5 rounded transition-colors cursor-pointer ${chartType === "line" ? "text-white" : "text-white/25 hover:text-white/55"}`}
                title="Line chart"
              >
                <TrendingUp size={15} />
              </button>
              <button
                onClick={() => setChartType("candle")}
                className={`p-1.5 rounded transition-colors cursor-pointer ${chartType === "candle" ? "text-white" : "text-white/25 hover:text-white/55"}`}
                title="Candle chart"
              >
                <BarChart2 size={15} />
              </button>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              {
                label: "Market Cap",
                value: `$${(market.marketCap / 1000000).toFixed(2)}M`,
              },
              {
                label: "24h Volume",
                value: `$${(market.volume24h / 1000).toFixed(1)}k`,
              },
              { label: "Mindshare", value: `${market.mindshare}%` },
              { label: "Holders", value: `${market.holders.toLocaleString()}` },
            ].map(({ label, value }) => (
              <div
                key={label}
                className="flex flex-col gap-1 bg-white/[0.02] border border-white/[0.06] rounded-xl px-4 py-3"
              >
                <span className="text-white/35 text-[11px] uppercase tracking-wide">
                  {label}
                </span>
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
              <span className="text-[#9C93E8] font-semibold text-sm">
                Price floor boosted
              </span>
            </div>
            <span className="text-[#9C93E8] font-mono font-bold text-sm bg-[rgba(156,147,232,0.15)] px-3 py-1 rounded-md">
              {market.ratchetMultiplier.toFixed(1)}x
            </span>
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
                    <span className="block pb-3">{tab}</span>
                    <span className="block pb-3" aria-hidden="true">{tab}</span>
                  </div>
                  {activeTab === tab && (
                    <span className="absolute bottom-0 left-0 w-full h-[2px] bg-[#9C93E8] rounded-full" />
                  )}
                </button>
              ))}
            </div>
            <div className="w-full text-center py-10 text-white/30 text-sm border border-white/[0.06] rounded-xl bg-white/[0.015]">
              No {activeTab} data yet.
            </div>
          </div>
        </div>

        {/* ── Right column: Trading panel ─────────────── */}
        <div className="w-full lg:w-[340px] shrink-0">
          <div
            className="border border-white/[0.08] rounded-xl p-5 flex flex-col gap-4 lg:sticky lg:top-20"
            style={{ background: "#000" }}
          >
            {/* Buy / Sell tabs */}
            <div className="flex gap-5">
              <button
                onClick={() => setTradeType("buy")}
                className={`h-[26px] overflow-hidden group transition-colors cursor-pointer ${
                  tradeType === "buy"
                    ? "text-[#00FF47] border-b-2 border-[#00FF47]"
                    : "text-white/35 hover:text-white/65"
                }`}
              >
                <div className="flex flex-col text-base font-bold group-hover:-translate-y-1/2 transition-transform duration-300 ease-out">
                  <span className="block pb-0.5">Buy</span>
                  <span className="block pb-0.5" aria-hidden="true">Buy</span>
                </div>
              </button>
              <button
                onClick={() => setTradeType("sell")}
                className={`h-[26px] overflow-hidden group transition-colors cursor-pointer ${
                  tradeType === "sell"
                    ? "text-[#EF4444] border-b-2 border-[#EF4444]"
                    : "text-white/35 hover:text-white/65"
                }`}
              >
                <div className="flex flex-col text-base font-bold group-hover:-translate-y-1/2 transition-transform duration-300 ease-out">
                  <span className="block pb-0.5">Sell</span>
                  <span className="block pb-0.5" aria-hidden="true">Sell</span>
                </div>
              </button>
            </div>

            {/* Balance */}
            <div className="flex items-center justify-between text-xs text-white/35">
              <span>Balance:</span>
              <span className="font-mono">— SOL</span>
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
                SOL
              </span>
            </div>

            {/* Percentage quick-select */}
            <div className="grid grid-cols-4 gap-2">
              {[25, 50, 75, 100].map((pct) => (
                <button
                  key={pct}
                  onClick={() => handlePct(pct)}
                  className="h-8 overflow-hidden group text-white/45 bg-white/[0.05] hover:bg-white/[0.09] rounded-lg transition-colors cursor-pointer"
                >
                  <div className="flex flex-col text-xs font-medium group-hover:-translate-y-1/2 transition-transform duration-300 ease-out">
                    <span className="block py-2">{pct}%</span>
                    <span className="block py-2" aria-hidden="true">{pct}%</span>
                  </div>
                </button>
              ))}
            </div>

            {/* Output preview */}
            <div className="flex items-center justify-between py-1 text-sm">
              <span className="text-white/60 font-mono">
                {estimatedTokens} {ticker}
              </span>
              <span className="text-white/30 text-xs">≈ 25.0%</span>
            </div>

            {/* Action button */}
            <button
              className={`w-full py-3.5 rounded-xl font-bold text-sm transition-colors cursor-pointer ${
                tradeType === "buy"
                  ? "bg-[#00FF47] text-black hover:brightness-110"
                  : "bg-white/[0.07] text-white hover:bg-white/[0.12]"
              }`}
            >
              {tradeType === "buy" ? "Buy" : "Sell"} {ticker}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
