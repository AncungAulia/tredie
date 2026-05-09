"use client";
import { useEffect, useRef } from "react";
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
  lastPrice?: number;
}

export default function TradingViewChart({
  lineData,
  candleData,
  chartType,
  color = "#9C93E8",
  lastPrice,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;

    const chart = createChart(el, {
      layout: {
        attributionLogo: false,
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "rgba(255,255,255,0.25)",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.04)" },
        horzLines: { color: "rgba(255,255,255,0.04)" },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: "rgba(255,255,255,0.15)",
          style: LineStyle.Dashed,
          labelBackgroundColor: "#1a1a1a",
        },
        horzLine: {
          color: "rgba(255,255,255,0.15)",
          style: LineStyle.Dashed,
          labelBackgroundColor: "#1a1a1a",
        },
      },
      rightPriceScale: {
        borderVisible: false,
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      timeScale: {
        borderVisible: false,
        fixLeftEdge: true,
        fixRightEdge: true,
        rightOffset: 3,
      },
      width: el.clientWidth,
      height: el.clientHeight,
    });

    const useCandle = chartType === "candle" && candleData.length > 0;

    if (useCandle) {
      const series = chart.addSeries(CandlestickSeries, {
        upColor: "#22C55E",
        downColor: "#EF4444",
        borderUpColor: "#22C55E",
        borderDownColor: "#EF4444",
        wickUpColor: "#22C55E",
        wickDownColor: "#EF4444",
      });
      series.setData(
        candleData.map((d) => ({ ...d, time: d.time as any }))
      );
    } else if (lineData.length > 0) {
      const series = chart.addSeries(AreaSeries, {
        lineColor: color,
        topColor: `${color}28`,
        bottomColor: `${color}00`,
        lineWidth: 2,
        crosshairMarkerRadius: 4,
        crosshairMarkerBorderColor: color,
        crosshairMarkerBackgroundColor: color,
      });
      series.setData(
        lineData.map((d) => ({ ...d, time: d.time as any }))
      );

      if (lastPrice !== undefined && isFinite(lastPrice)) {
        series.createPriceLine({
          price: lastPrice,
          color: color,
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: false,
          title: "",
        });
      }
    }

    chart.timeScale().fitContent();

    const ro = new ResizeObserver(() => {
      chart.applyOptions({
        width: el.clientWidth,
        height: el.clientHeight,
      });
    });
    ro.observe(el);

    return () => {
      ro.disconnect();
      chart.remove();
    };
  }, [lineData, candleData, chartType, color, lastPrice]);

  return <div ref={containerRef} className="w-full h-full" />;
}
