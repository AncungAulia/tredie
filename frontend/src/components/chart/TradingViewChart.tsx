"use client";
import { useEffect, useRef, useState } from "react";
import {
  createChart,
  ColorType,
  CrosshairMode,
  LineStyle,
  AreaSeries,
  CandlestickSeries,
  HistogramSeries,
} from "lightweight-charts";

export type LinePoint = { time: number; value: number };
export type CandlePoint = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
};
export type VolumePoint = { time: number; value: number; color: string };

interface Props {
  lineData: LinePoint[];
  candleData: CandlePoint[];
  volumeData?: VolumePoint[];
  chartType: "line" | "candle";
  color?: string;
  mcapFactor?: number; // virtualTokenSupply_human × solPriceUsd; if > 0, Y-axis shows USD mcap
}

type TooltipState = {
  time: string;
  price: string;
  ohlc?: { o: string; h: string; l: string; c: string };
  x: number;
  y: number;
  flipLeft: boolean;
} | null;

function formatTooltipTime(unix: number): string {
  const d = new Date(unix * 1000);
  return d.toLocaleString("en", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function fmtSol(val: number): string {
  if (val <= 0) return "0 SOL";
  if (val >= 1) return `${val.toFixed(3)} SOL`;
  if (val >= 0.001) return `${val.toFixed(5)} SOL`;
  const exp = Math.floor(Math.log10(val));
  const decimals = Math.min(-exp + 2, 10);
  return `${val.toFixed(decimals).replace(/\.?0+$/, "") || "0"} SOL`;
}

function fmtUsd(val: number): string {
  if (val <= 0) return "$0";
  if (val >= 1_000_000_000) return `$${(val / 1_000_000_000).toFixed(2)}B`;
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(2)}M`;
  if (val >= 1_000) return `$${(val / 1_000).toFixed(2)}K`;
  if (val >= 1) return `$${val.toFixed(2)}`;
  return `$${val.toFixed(4)}`;
}

function fmtUsdAxis(val: number): string {
  if (val <= 0) return "$0";
  if (val >= 1_000_000_000) return `$${(val / 1_000_000_000).toFixed(1)}B`;
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `$${(val / 1_000).toFixed(1)}K`;
  if (val >= 1) return `$${val.toFixed(0)}`;
  return `$${val.toFixed(2)}`;
}

export default function TradingViewChart({
  lineData,
  candleData,
  volumeData,
  chartType,
  color = "#9C93E8",
  mcapFactor = 0,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<TooltipState>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const isUsd = mcapFactor > 0;
    const hasVolume = volumeData && volumeData.length > 0;

    const chart = createChart(el, {
      handleScroll: false,
      handleScale: false,
      layout: {
        attributionLogo: false,
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "rgba(255,255,255,0.35)",
        fontSize: 11,
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { color: "rgba(255,255,255,0.04)" },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: "rgba(255,255,255,0.15)",
          style: LineStyle.Dashed,
          labelVisible: false,
        },
        horzLine: {
          color: "rgba(255,255,255,0.08)",
          style: LineStyle.Dashed,
          labelVisible: false,
        },
      },
      rightPriceScale: {
        borderVisible: false,
        visible: isUsd,
        scaleMargins: {
          top: 0.08,
          bottom: hasVolume ? 0.28 : 0.08,
        },
      },
      timeScale: {
        borderVisible: false,
        visible: true,
        rightOffset: 0,
        lockVisibleTimeRangeOnResize: true,
        timeVisible: true,
        secondsVisible: false,
      },
      width: el.clientWidth,
      height: el.clientHeight,
    });

    const priceFormat = isUsd
      ? ({ type: "custom", formatter: fmtUsdAxis, minMove: 0.01 } as any)
      : undefined;

    const useCandle = chartType === "candle" && candleData.length > 0;
    let currentSeries: ReturnType<typeof chart.addSeries> | null = null;
    let dataLength = 0;

    if (useCandle) {
      const transformed = candleData.map((d) => ({
        time: d.time as any,
        open: isUsd ? d.open * mcapFactor : d.open,
        high: isUsd ? d.high * mcapFactor : d.high,
        low: isUsd ? d.low * mcapFactor : d.low,
        close: isUsd ? d.close * mcapFactor : d.close,
      }));
      currentSeries = chart.addSeries(CandlestickSeries, {
        upColor: "#22C55E",
        downColor: "#EF4444",
        borderUpColor: "#22C55E",
        borderDownColor: "#EF4444",
        wickUpColor: "#22C55E",
        wickDownColor: "#EF4444",
        priceFormat,
      });
      currentSeries.setData(transformed);
      dataLength = transformed.length;
    } else if (lineData.length > 0) {
      const transformed = lineData.map((d) => ({
        time: d.time as any,
        value: isUsd ? d.value * mcapFactor : d.value,
      }));
      currentSeries = chart.addSeries(AreaSeries, {
        lineColor: color,
        topColor: `${color}22`,
        bottomColor: `${color}00`,
        lineWidth: 2,
        crosshairMarkerRadius: 3,
        crosshairMarkerBorderColor: color,
        crosshairMarkerBackgroundColor: "#09090B",
        crosshairMarkerBorderWidth: 2,
        priceLineVisible: false,
        priceFormat,
      });
      currentSeries.setData(transformed);
      dataLength = transformed.length;
    }

    if (hasVolume) {
      const volSeries = chart.addSeries(HistogramSeries, {
        priceFormat: { type: "volume" } as any,
        priceScaleId: "vol",
      } as any);
      chart.priceScale("vol").applyOptions({
        scaleMargins: { top: 0.78, bottom: 0 },
        visible: false,
      });
      volSeries.setData(volumeData!.map((d) => ({ time: d.time as any, value: d.value, color: d.color })));
    }

    const fitEdgeToEdge = () => {
      if (dataLength >= 2) {
        chart.timeScale().setVisibleLogicalRange({ from: -0.5, to: dataLength - 0.5 });
      } else {
        chart.timeScale().fitContent();
      }
    };

    fitEdgeToEdge();

    chart.subscribeCrosshairMove((param) => {
      if (!param.time || !param.point || !currentSeries) {
        setTooltip(null);
        return;
      }
      const raw = param.seriesData.get(currentSeries) as any;
      if (!raw) {
        setTooltip(null);
        return;
      }

      const flipLeft = param.point.x > el.clientWidth - 160;
      const fmt = isUsd ? fmtUsd : fmtSol;

      if ("value" in raw) {
        setTooltip({
          time: formatTooltipTime(param.time as number),
          price: fmt(raw.value),
          x: param.point.x,
          y: param.point.y,
          flipLeft,
        });
      } else {
        setTooltip({
          time: formatTooltipTime(param.time as number),
          price: fmt(raw.close),
          ohlc: {
            o: fmt(raw.open),
            h: fmt(raw.high),
            l: fmt(raw.low),
            c: fmt(raw.close),
          },
          x: param.point.x,
          y: param.point.y,
          flipLeft,
        });
      }
    });

    const ro = new ResizeObserver(() => {
      chart.applyOptions({ width: el.clientWidth, height: el.clientHeight });
      fitEdgeToEdge();
    });
    ro.observe(el);

    return () => {
      ro.disconnect();
      chart.remove();
      setTooltip(null);
    };
  }, [lineData, candleData, volumeData, chartType, color, mcapFactor]);

  return (
    <div className="relative w-full h-full" onMouseLeave={() => setTooltip(null)}>
      {tooltip && (
        <div
          className="absolute z-20 pointer-events-none"
          style={{
            left: tooltip.flipLeft ? tooltip.x - 14 : tooltip.x + 14,
            top: Math.max(8, tooltip.y - (tooltip.ohlc ? 80 : 52)),
            transform: tooltip.flipLeft ? "translateX(-100%)" : "none",
          }}
        >
          <div
            className="rounded-xl px-3 py-2.5 flex flex-col gap-1.5 min-w-[120px] shadow-2xl"
            style={{
              background: "rgba(10,10,12,0.92)",
              border: "1px solid rgba(255,255,255,0.10)",
              backdropFilter: "blur(8px)",
            }}
          >
            <span className="text-white font-mono font-semibold text-sm leading-none">
              {tooltip.price}
            </span>
            {tooltip.ohlc && (
              <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                {(["o", "h", "l", "c"] as const).map((k) => (
                  <div key={k} className="flex items-center gap-1">
                    <span className="text-white/30 text-[9px] uppercase font-mono">{k}</span>
                    <span className="text-white/70 text-[10px] font-mono">{tooltip.ohlc![k]}</span>
                  </div>
                ))}
              </div>
            )}
            <span className="text-white/35 font-mono text-[10px] leading-none">
              {tooltip.time}
            </span>
          </div>
        </div>
      )}
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}
