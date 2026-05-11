"use client";
import { useEffect, useRef, useState, useMemo } from "react";
import {
  createChart,
  ColorType,
  CrosshairMode,
  LineType,
  AreaSeries,
} from "lightweight-charts";
import { useOHLC } from "@/hooks/useOHLC";
import type { Market } from "@/types/api";

interface Props {
  identifier: string;
  market: Market;
  color?: string;
  heightClass?: string;
}

export default function CardChart({
  identifier,
  market,
  color = "#9C93E8",
  heightClass = "h-full",
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const seriesRef = useRef<any>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [dotPos, setDotPos] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          obs.disconnect();
        }
      },
      { threshold: 0.01 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const { data: ohlcData } = useOHLC(identifier, "5m", 300, isVisible, false);

  const pricePerToken = useMemo(() => {
    const denom = Number(market.virtual_token_supply) - Number(market.tokens_minted);
    if (denom <= 0) return 0;
    const spotSol =
      (Number(market.real_sol_reserves) + Number(market.base_virtual_sol)) / denom / 1e9;
    return spotSol * 1e6;
  }, [market]);

  const lineData = useMemo(() => {
    const candles = ohlcData?.candles ?? [];
    const now = Math.floor(Date.now() / 1000);
    const lookback = 24 * 3600;
    const step = 10 * 60;

    const sorted = [...candles]
      .map((c) => ({
        time: Number(c.bucket ?? c.time),
        price: Number(c.close) / 1000,
      }))
      .filter((c) => c.time >= now - lookback)
      .sort((a, b) => a.time - b.time);

    const from =
      sorted.length > 0
        ? Math.floor(sorted[0].time / step) * step
        : Math.floor((now - lookback) / step) * step;

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

    if (result.length > 0 && result[result.length - 1].time < now) {
      result.push({ time: now, value: lastPrice });
    }

    if (result.length < 2) return [];

    const TARGET = 35;
    const sampled =
      result.length > TARGET
        ? Array.from({ length: TARGET }, (_, i) =>
            result[Math.round((i * (result.length - 1)) / (TARGET - 1))]
          )
        : result;

    let out = sampled;
    for (let p = 0; p < 5; p++) {
      out = out.map((d, i) => {
        if (i === 0 || i === out.length - 1) return d;
        return {
          time: d.time,
          value: out[i - 1].value * 0.25 + d.value * 0.5 + out[i + 1].value * 0.25,
        };
      });
    }

    return out;
  }, [ohlcData, pricePerToken]);

  useEffect(() => {
    if (!isVisible || !containerRef.current || lineData.length < 2) return;
    const el = containerRef.current;

    const chart = createChart(el, {
      handleScroll: false,
      handleScale: false,
      layout: {
        attributionLogo: false,
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "rgba(0,0,0,0)",
        fontSize: 11,
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { visible: false },
      },
      crosshair: { mode: CrosshairMode.Hidden },
      rightPriceScale: {
        borderVisible: false,
        visible: false,
        scaleMargins: { top: 0.10, bottom: 0.08 },
      },
      timeScale: {
        borderVisible: false,
        visible: false,
        rightOffset: 2,
        lockVisibleTimeRangeOnResize: true,
      },
      width: el.clientWidth,
      height: el.clientHeight,
    });

    const series = chart.addSeries(AreaSeries, {
      lineColor: color,
      topColor: `${color}33`,
      bottomColor: `${color}00`,
      lineWidth: 2,
      crosshairMarkerRadius: 0,
      crosshairMarkerBorderWidth: 0,
      priceLineVisible: false,
      lineType: LineType.Curved,
    });

    series.setData(lineData.map((d) => ({ ...d, time: d.time as any })));
    seriesRef.current = series;

    const updateDot = () => {
      const s = seriesRef.current;
      if (!s) { setDotPos(null); return; }
      const last = lineData[lineData.length - 1];
      const x = chart.timeScale().timeToCoordinate(last.time as any);
      const y = s.priceToCoordinate(last.value);
      if (x !== null && y !== null) setDotPos({ x, y });
      else setDotPos(null);
    };

    chart.timeScale().fitContent();
    const rafId = requestAnimationFrame(() => {
      chart.applyOptions({ width: el.clientWidth, height: el.clientHeight });
      chart.timeScale().fitContent();
      updateDot();
    });

    const ro = new ResizeObserver(() => {
      chart.applyOptions({ width: el.clientWidth, height: el.clientHeight });
      requestAnimationFrame(() => {
        chart.timeScale().fitContent();
        updateDot();
      });
    });
    ro.observe(el);

    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
      chart.remove();
      seriesRef.current = null;
      setDotPos(null);
    };
  }, [isVisible, lineData, color]);

  return (
    <div ref={wrapRef} className={`relative w-full ${heightClass} pointer-events-none`}>
      <div ref={containerRef} className="w-full h-full" />
      {dotPos && (
        <div
          className="absolute pointer-events-none"
          style={{
            left: dotPos.x - 4,
            top: dotPos.y - 4,
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: color,
            boxShadow: `0 0 6px 2px ${color}66`,
          }}
        />
      )}
    </div>
  );
}
