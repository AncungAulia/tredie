"use client";
import { useEffect, useRef, useState } from "react";
import {
  createChart,
  ColorType,
  CrosshairMode,
  LineStyle,
  LineType,
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
  virtualSupply?: number;
  solPriceUsd?: number;
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


function fmt(val: number): string {
  if (val <= 0) return "0";
  if (val >= 1) return val.toFixed(3);
  if (val >= 0.001) return val.toFixed(5);
  const exp = Math.floor(Math.log10(val));
  const decimals = Math.min(-exp + 2, 10);
  return val.toFixed(decimals).replace(/\.?0+$/, "") || "0";
}

// Catmull-Rom spline → SVG cubic bezier (matches lightweight-charts' curved line rendering)
function catmullRomPath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return "";
  const d: string[] = [`M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d.push(`C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)} ${cp2x.toFixed(2)} ${cp2y.toFixed(2)} ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`);
  }
  return d.join(" ");
}

function fmtMcap(price: number, virtualSupply: number, solPriceUsd: number): string {
  const sol = price * virtualSupply;
  if (solPriceUsd > 0) {
    const usd = sol * solPriceUsd;
    if (usd >= 1_000_000_000) return `$${(usd / 1_000_000_000).toFixed(2)}B`;
    if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(2)}M`;
    if (usd >= 1_000) return `$${(usd / 1_000).toFixed(2)}K`;
    if (usd >= 1) return `$${usd.toFixed(2)}`;
    return `$${usd.toFixed(4)}`;
  }
  if (sol >= 1_000_000) return `${(sol / 1_000_000).toFixed(2)}M SOL`;
  if (sol >= 1_000) return `${(sol / 1_000).toFixed(2)}K SOL`;
  return `${sol.toFixed(2)} SOL`;
}

export default function TradingViewChart({
  lineData,
  candleData,
  chartType,
  color = "#9C93E8",
  virtualSupply,
  solPriceUsd,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<TooltipState>(null);
  const [dotPos, setDotPos] = useState<{ x: number; y: number } | null>(null);
  const [hoverDot, setHoverDot] = useState<{ x: number; y: number } | null>(null);

  // Refs so tooltip formatting always reads latest values without adding them
  // to the effect dep array (which would destroy + remount the chart on every
  // SOL price tick or market data poll, breaking hover state).
  const virtualSupplyRef = useRef(virtualSupply);
  virtualSupplyRef.current = virtualSupply;
  const solPriceUsdRef = useRef(solPriceUsd);
  solPriceUsdRef.current = solPriceUsd;

  const animFrameRef = useRef<number | null>(null);
  // Tracks the last X where the cursor was on the chart (even at edges where hoverDot is null)
  const lastHoverXRef = useRef<number | null>(null);
  const dataSeriesRef = useRef<any>(null);
  const fgSeriesRef = useRef<any>(null);
  const linePointsRef = useRef<{ x: number; v: number; t: number }[]>([]);
  const isPointerOverRef = useRef(false);
  const outerRef = useRef<HTMLDivElement>(null);
  const svgUid = useRef(`tc${Math.random().toString(36).slice(2)}`).current;
  const [brightPts, setBrightPts] = useState<{ x: number; y: number }[]>([]);
  const [clipX, setClipX] = useState<number | null>(null);

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
        horzLines: { color: "rgba(255,255,255,0.08)", visible: true },
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

    const priceFormat = {
      type: "custom" as const,
      formatter: fmt,
      minMove: 0.000001,
    };

    const useCandle = chartType === "candle" && candleData.length > 0;

    if (useCandle) {
      const cs = chart.addSeries(CandlestickSeries, {
        upColor: "#22C55E",
        downColor: "#EF4444",
        borderUpColor: "#22C55E",
        borderDownColor: "#EF4444",
        wickUpColor: "#22C55E",
        wickDownColor: "#EF4444",
        priceFormat,
      });
      cs.setData(candleData.map((d) => ({ ...d, time: d.time as any })));
      dataSeriesRef.current = cs;
      fgSeriesRef.current = cs;
    } else if (lineData.length > 0) {
      const allData = lineData.map((d) => ({ ...d, time: d.time as any }));

      // Invisible series — never mutated, used only for param.seriesData reads
      const ds = chart.addSeries(AreaSeries, {
        lineColor: "rgba(0,0,0,0)",
        topColor: "rgba(0,0,0,0)",
        bottomColor: "rgba(0,0,0,0)",
        crosshairMarkerRadius: 0,
        crosshairMarkerBorderWidth: 0,
        priceLineVisible: false,
        priceFormat,
      });
      ds.setData(allData);
      dataSeriesRef.current = ds;

      // Single bright series — full data always
      const fg = chart.addSeries(AreaSeries, {
        lineColor: color,
        topColor: `${color}22`,
        bottomColor: `${color}00`,
        lineWidth: 2,
        crosshairMarkerRadius: 0,
        crosshairMarkerBorderWidth: 0,
        priceLineVisible: false,
        lineType: LineType.Curved,
        priceFormat,
      });
      fg.setData(allData);
      fgSeriesRef.current = fg;

      fg.createPriceLine({
        price: lineData[lineData.length - 1].value,
        color: `${color}80`,
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: false,
        title: "",
      });
    }

    const updateLinePoints = () => {
      if (useCandle || lineData.length === 0) { linePointsRef.current = []; return; }
      linePointsRef.current = lineData
        .map((d) => {
          const x = chart.timeScale().timeToCoordinate(d.time as any);
          return x !== null ? { x, v: d.value, t: d.time } : null;
        })
        .filter(Boolean) as { x: number; v: number; t: number }[];
    };

    const updateDot = () => {
      const fg = fgSeriesRef.current;
      if (!fg || useCandle || lineData.length === 0) { setDotPos(null); return; }
      const last = lineData[lineData.length - 1];
      const x = chart.timeScale().timeToCoordinate(last.time as any);
      const y = fg.priceToCoordinate(last.value);
      if (x !== null && y !== null) setDotPos({ x, y });
      else setDotPos(null);
    };

    const updateBrightPts = () => {
      if (useCandle || lineData.length === 0) { setBrightPts([]); return; }
      const fg = fgSeriesRef.current;
      if (!fg) return;
      const pts = lineData
        .map((d) => {
          const x = chart.timeScale().timeToCoordinate(d.time as any);
          const y = fg.priceToCoordinate(d.value);
          return x !== null && y !== null ? { x: x as number, y: y as number } : null;
        })
        .filter(Boolean) as { x: number; y: number }[];
      setBrightPts(pts);
    };

    chart.timeScale().fitContent();
    // Defer coordinate calculation by one frame so the chart has finished
    // applying fitContent() before we read timeToCoordinate/priceToCoordinate
    requestAnimationFrame(() => {
      updateDot();
      updateLinePoints();
      updateBrightPts();
    });

    chart.subscribeCrosshairMove((param) => {
      // Ignore library crosshair events fired after resize with stale positions
      if (!isPointerOverRef.current) return;

      // Cancel return animation when user re-enters chart
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }

      const fg = fgSeriesRef.current;
      const ds = dataSeriesRef.current;

      if (!param.time || !param.point || !ds) {
        setTooltip(null);
        setHoverDot(null);
        setClipX(null);
        return;
      }

      setClipX(param.point.x);

      // Hover dot: interpolate Y on line at cursor X; clamp to last point if past end
      if (!useCandle && fg) {
        const pts = linePointsRef.current;
        let dotX = param.point.x as number;
        let lineY: number | null = null;

        for (let i = 0; i < pts.length - 1; i++) {
          if (pts[i].x <= param.point.x && pts[i + 1].x >= param.point.x) {
            const t = (param.point.x - pts[i].x) / (pts[i + 1].x - pts[i].x);
            const interpV = pts[i].v + t * (pts[i + 1].v - pts[i].v);
            lineY = fg.priceToCoordinate(interpV) ?? null;
            break;
          }
        }

        if (lineY === null && pts.length > 0 && param.point.x >= pts[pts.length - 1].x) {
          dotX = pts[pts.length - 1].x;
          lineY = fg.priceToCoordinate(pts[pts.length - 1].v) ?? null;
        }

        if (lineY !== null) {
          lastHoverXRef.current = dotX;
          setHoverDot({ x: dotX, y: lineY });
        } else {
          // Track X even when off the data range (for return animation start point)
          lastHoverXRef.current = param.point.x;
          setHoverDot(null);
        }
      }

      const raw = param.seriesData.get(ds) as any;
      if (!raw) { setTooltip(null); return; }

      const flipLeft = param.point.x > el.clientWidth - 140;

      if ("value" in raw) {
        const price =
          virtualSupplyRef.current != null
            ? fmtMcap(raw.value, virtualSupplyRef.current, solPriceUsdRef.current ?? 0)
            : `${fmt(raw.value)} SOL`;
        setTooltip({
          time: formatTooltipTime(param.time as number),
          price,
          x: param.point.x,
          y: param.point.y,
          flipLeft,
        });
      } else {
        setTooltip({
          time: formatTooltipTime(param.time as number),
          price: `${fmt(raw.close)} SOL`,
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
      chart.timeScale().fitContent();
      // Clear stale hover state — coordinates are invalid after resize
      isPointerOverRef.current = false;
      setTooltip(null);
      setHoverDot(null);
      lastHoverXRef.current = null;
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      // Defer coordinate recalculation by one frame (same reason as initial mount)
      requestAnimationFrame(() => {
        updateDot();
        updateLinePoints();
        updateBrightPts();
      });
    });
    ro.observe(el);
    // If cursor was already inside the chart when this effect re-ran (e.g. after
    // lineData update), recover hover state so crosshair events aren't dropped.
    if (outerRef.current?.matches?.(':hover')) {
      isPointerOverRef.current = true;
    }

    return () => {
      ro.disconnect();
      chart.remove();
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      dataSeriesRef.current = null;
      fgSeriesRef.current = null;
      setTooltip(null);
      setDotPos(null);
      setHoverDot(null);
      setBrightPts([]);
      setClipX(null);
    };
  }, [lineData, candleData, chartType, color]);

  // Prevent page scroll while the user scrubs the chart with a finger
  useEffect(() => {
    const el = outerRef.current;
    if (!el) return;
    const prevent = (e: TouchEvent) => e.preventDefault();
    el.addEventListener("touchmove", prevent, { passive: false });
    return () => el.removeEventListener("touchmove", prevent);
  }, []);

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (chartType === "candle") return;
    const touch = e.touches[0];
    const el = containerRef.current;
    const fg = fgSeriesRef.current;
    if (!el || !fg) return;

    const rect = el.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const pts = linePointsRef.current;
    if (pts.length === 0) return;

    let lineY: number | null = null;
    let dotX = x;
    let price: number | null = null;
    let timeVal: number | null = null;

    // Clamp to first point if before data starts
    if (x <= pts[0].x) {
      dotX = pts[0].x;
      price = pts[0].v;
      timeVal = pts[0].t;
      lineY = fg.priceToCoordinate(pts[0].v) ?? null;
    } else {
      for (let i = 0; i < pts.length - 1; i++) {
        if (pts[i].x <= x && pts[i + 1].x >= x) {
          const t = (x - pts[i].x) / (pts[i + 1].x - pts[i].x);
          price = pts[i].v + t * (pts[i + 1].v - pts[i].v);
          timeVal = Math.round(pts[i].t + t * (pts[i + 1].t - pts[i].t));
          lineY = fg.priceToCoordinate(price) ?? null;
          break;
        }
      }
      // Clamp to last point if past data end
      if (lineY === null && x >= pts[pts.length - 1].x) {
        const last = pts[pts.length - 1];
        dotX = last.x;
        price = last.v;
        timeVal = last.t;
        lineY = fg.priceToCoordinate(last.v) ?? null;
      }
    }

    if (lineY !== null && price !== null && timeVal !== null) {
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      lastHoverXRef.current = dotX;
      setHoverDot({ x: dotX, y: lineY });
      setClipX(dotX);
      const flipLeft = dotX > el.clientWidth - 140;
      const priceStr =
        virtualSupply != null
          ? fmtMcap(price, virtualSupply, solPriceUsd ?? 0)
          : `${fmt(price)} SOL`;
      setTooltip({
        time: formatTooltipTime(timeVal),
        price: priceStr,
        x: dotX,
        y: lineY,
        flipLeft,
      });
    }
  };

  const isHovering = tooltip !== null;

  const handleMouseLeave = () => {
    setTooltip(null);
    setClipX(null);

    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }

    if (!dotPos) {
      setHoverDot(null);
      lastHoverXRef.current = null;
      return;
    }

    const pts = linePointsRef.current;
    const fg = fgSeriesRef.current;
    if (!pts.length || !fg) {
      setHoverDot(null);
      lastHoverXRef.current = null;
      return;
    }

    // Use the last tracked X (works even when leaving from left/right edges
    // where hoverDot might already be null due to cursor leaving data range)
    const startX = lastHoverXRef.current ?? hoverDot?.x ?? dotPos.x;
    const endX = dotPos.x;

    if (Math.abs(startX - endX) < 2) {
      setHoverDot(null);
      lastHoverXRef.current = null;
      return;
    }

    const duration = 450;
    const startTime = performance.now();

    // Animate dot back to endpoint along the actual line chart path
    const animate = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1);
      // Ease-out cubic — smooth deceleration, no bounce
      const eased = 1 - Math.pow(1 - progress, 3);
      const currentX = startX + eased * (endX - startX);

      // Find Y on the line path at currentX
      const currentFg = fgSeriesRef.current;
      if (!currentFg) { animFrameRef.current = null; return; }

      let lineY: number | null = null;
      for (let i = 0; i < pts.length - 1; i++) {
        if (pts[i].x <= currentX && pts[i + 1].x >= currentX) {
          const t = (currentX - pts[i].x) / (pts[i + 1].x - pts[i].x);
          const interpV = pts[i].v + t * (pts[i + 1].v - pts[i].v);
          lineY = currentFg.priceToCoordinate(interpV) ?? null;
          break;
        }
      }
      // Past last data point — clamp to last point
      if (lineY === null && pts.length > 0 && currentX >= pts[pts.length - 1].x) {
        lineY = currentFg.priceToCoordinate(pts[pts.length - 1].v) ?? null;
      }

      if (lineY !== null) {
        setHoverDot({ x: currentX, y: lineY });
      }

      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(animate);
      } else {
        // Animation complete — hide hover dot, let dotPos take over
        setHoverDot(null);
        animFrameRef.current = null;
        lastHoverXRef.current = null;
      }
    };

    animFrameRef.current = requestAnimationFrame(animate);
  };

  return (
    <div
      ref={outerRef}
      className="relative w-full h-full"
      style={{ background: `${color}0d` }}
      onMouseEnter={() => { isPointerOverRef.current = true; }}
      onMouseLeave={() => { isPointerOverRef.current = false; handleMouseLeave(); }}
      onTouchStart={() => {
        isPointerOverRef.current = true;
        if (animFrameRef.current !== null) {
          cancelAnimationFrame(animFrameRef.current);
          animFrameRef.current = null;
        }
      }}
      onTouchMove={handleTouchMove}
      onTouchEnd={() => { isPointerOverRef.current = false; handleMouseLeave(); }}
    >
      {/* Dim SVG line — multiply blend darkens only the bright canvas line on the right of crosshair */}
      {chartType !== "candle" && brightPts.length >= 2 && clipX !== null && (
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          style={{ zIndex: 6, mixBlendMode: "multiply" }}
        >
          <defs>
            <clipPath id={svgUid}>
              <rect x={clipX} y={0} width={9999} height={9999} />
            </clipPath>
          </defs>
          <path
            d={catmullRomPath(brightPts)}
            fill="none"
            stroke="rgb(60,60,80)"
            strokeWidth={3}
            strokeLinecap="round"
            clipPath={`url(#${svgUid})`}
          />
        </svg>
      )}

      {(hoverDot ?? (!isHovering ? dotPos : null)) && (
        <div
          className="absolute pointer-events-none"
          style={{
            left: (hoverDot ?? dotPos)!.x - 5,
            top: (hoverDot ?? dotPos)!.y - 5,
            width: 10,
            height: 10,
            borderRadius: "50%",
            background: color,
            boxShadow: `0 0 6px 2px ${color}66`,
            zIndex: 15,
          }}
        />
      )}

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
            className="rounded-xl px-3 py-2.5 flex flex-col gap-1.5 min-w-[110px] shadow-2xl"
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
