"use client";
import { useEffect, useRef, useState } from "react";
import {
  createChart,
  ColorType,
  CrosshairMode,
  LineStyle,
  AreaSeries,
  CandlestickSeries,
} from "lightweight-charts";

export type LinePoint = { time: number; value: number };
export type CandlePoint = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
};

interface Props {
  lineData: LinePoint[];
  candleData: CandlePoint[];
  chartType: "line" | "candle";
  color?: string;
}

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

export default function TradingViewChart({
  lineData,
  candleData,
  chartType,
  color = "#9C93E8",
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;

    const chart = createChart(el, {
      handleScroll: false,
      handleScale: false,
      layout: {
        attributionLogo: false,
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "rgba(255,255,255,0.28)",
        fontSize: 11,
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { visible: false },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: "rgba(255,255,255,0.18)",
          style: LineStyle.Dashed,
          labelVisible: false,
        },
        horzLine: {
          color: "rgba(255,255,255,0.08)",
          style: LineStyle.Dashed,
          labelBackgroundColor: color,
        },
      },
      rightPriceScale: {
        borderVisible: false,
        visible: false,
        scaleMargins: { top: 0.08, bottom: 0.08 },
      },
      timeScale: {
        borderVisible: false,
        visible: false,
        rightOffset: 0,
        lockVisibleTimeRangeOnResize: true,
      },
      width: el.clientWidth,
      height: el.clientHeight,
    });

    const useCandle = chartType === "candle" && candleData.length > 0;

    let dataLength = 0;

    if (useCandle) {
      const series = chart.addSeries(CandlestickSeries, {
        upColor: "#22C55E",
        downColor: "#EF4444",
        borderUpColor: "#22C55E",
        borderDownColor: "#EF4444",
        wickUpColor: "#22C55E",
        wickDownColor: "#EF4444",
      });
      series.setData(candleData.map((d) => ({ ...d, time: d.time as any })));
      dataLength = candleData.length;
    } else if (lineData.length > 0) {
      const series = chart.addSeries(AreaSeries, {
        lineColor: color,
        topColor: `${color}18`,
        bottomColor: `${color}00`,
        lineWidth: 2,
        crosshairMarkerRadius: 3,
        crosshairMarkerBorderColor: color,
        crosshairMarkerBackgroundColor: "#09090B",
        crosshairMarkerBorderWidth: 2,
        priceLineVisible: false,
      });
      series.setData(lineData.map((d) => ({ ...d, time: d.time as any })));
      dataLength = lineData.length;
    }

    // setVisibleLogicalRange: index -0.5 → n-0.5 memaksa titik pertama
    // tepat di tepi kiri dan titik terakhir tepat di tepi kanan (true edge-to-edge)
    const fitEdgeToEdge = () => {
      if (dataLength >= 2) {
        chart.timeScale().setVisibleLogicalRange({
          from: -0.5,
          to: dataLength - 0.5,
        });
      } else {
        chart.timeScale().fitContent();
      }
    };

    fitEdgeToEdge();

    chart.subscribeCrosshairMove((param) => {
      if (!param.time || !param.point) {
        setTooltip(null);
        return;
      }
      setTooltip(formatTooltipTime(param.time as number));
    });

    const ro = new ResizeObserver(() => {
      chart.applyOptions({ width: el.clientWidth, height: el.clientHeight });
      fitEdgeToEdge();
    });
    ro.observe(el);

    return () => {
      ro.disconnect();
      chart.remove();
    };
  }, [lineData, candleData, chartType, color]);

  return (
    <div className="relative w-full h-full">
      {/* Noise.xyz-style date tooltip di atas tengah */}
      <div
        className={`absolute top-3 left-1/2 -translate-x-1/2 z-10 px-3 py-1 rounded-full bg-white/[0.07] border border-white/[0.09] text-white/55 text-xs font-mono pointer-events-none transition-opacity duration-100 ${
          tooltip ? "opacity-100" : "opacity-0"
        }`}
      >
        {tooltip ?? ""}
      </div>
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}
