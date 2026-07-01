import { useEffect, useId, useMemo, useRef, useState } from "react";
import { compact } from "../lib/format";

interface Props {
  months: string[];
  values: number[];
  metricLabel: string;
  emptyLabel?: string;
}

interface Point {
  x: number;
  y: number;
  value: number;
  label: string;
}

const MIN_HEIGHT = 260;
const MAX_HEIGHT = 360;
const PAD = { top: 18, right: 18, bottom: 32, left: 48 };

function niceMax(value: number) {
  if (value <= 0) return 1;
  const exp = Math.floor(Math.log10(value));
  const base = 10 ** exp;
  const n = value / base;
  const nice = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return nice * base;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function niceStep(value: number) {
  if (value <= 0) return 1;
  const exp = Math.floor(Math.log10(value));
  const base = 10 ** exp;
  const n = value / base;
  const nice = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return nice * base;
}

function linePath(points: Point[]) {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;

  const slopes = points.slice(0, -1).map((p, i) => {
    const next = points[i + 1];
    return (next.y - p.y) / Math.max(1, next.x - p.x);
  });
  const tangents = points.map((_, i) => {
    if (i === 0) return slopes[0];
    if (i === points.length - 1) return slopes[slopes.length - 1];
    return slopes[i - 1] * slopes[i] <= 0 ? 0 : (slopes[i - 1] + slopes[i]) / 2;
  });

  let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const dx = b.x - a.x;
    const minY = Math.min(a.y, b.y);
    const maxY = Math.max(a.y, b.y);
    const c1x = a.x + dx / 3;
    const c2x = b.x - dx / 3;
    const c1y = clamp(a.y + tangents[i] * dx / 3, minY, maxY);
    const c2y = clamp(b.y - tangents[i + 1] * dx / 3, minY, maxY);
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
  }
  return d;
}

function useElementSize() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const update = () => {
      const rect = el.getBoundingClientRect();
      setSize({ width: Math.round(rect.width), height: Math.round(rect.height) });
    };
    update();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", update);
      return () => window.removeEventListener("resize", update);
    }

    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return { ref, ...size };
}

export function TimeSeriesAreaChart({
  months,
  values,
  metricLabel,
  emptyLabel = "No archived activity in this range",
}: Props) {
  const gradId = useId().replace(/:/g, "");
  const { ref, width, height } = useElementSize();
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const hasData = values.some((v) => v > 0);
  const chartWidth = Math.max(width, 320);
  const chartHeight = clamp(Math.max(height, MIN_HEIGHT), MIN_HEIGHT, MAX_HEIGHT);
  const plotWidth = Math.max(1, chartWidth - PAD.left - PAD.right);
  const plotHeight = chartHeight - PAD.top - PAD.bottom;
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const rawRange = maxValue - minValue;
  const shouldZoomDomain = minValue > 0 && rawRange > 0 && rawRange / maxValue < 0.35;
  const tickCount = 4;
  const paddedRange = Math.max(1, rawRange * 1.18);
  const zoomStep = niceStep(paddedRange / tickCount);
  const zeroStep = niceMax(maxValue) / tickCount;
  const domainMin = shouldZoomDomain ? Math.max(0, Math.floor((minValue - rawRange * 0.09) / zoomStep) * zoomStep) : 0;
  const domainMax = shouldZoomDomain ? Math.ceil((maxValue + rawRange * 0.09) / zoomStep) * zoomStep : niceMax(maxValue);
  const domainSpan = Math.max(1, domainMax - domainMin);
  const step = shouldZoomDomain ? zoomStep : zeroStep;
  const yTicks = Array.from({ length: tickCount + 1 }, (_, i) => domainMin + step * i);

  const points = useMemo<Point[]>(() => {
    if (!values.length) return [];
    return values.map((value, i) => {
      const x = PAD.left + (values.length === 1 ? plotWidth / 2 : (i / (values.length - 1)) * plotWidth);
      const y = PAD.top + plotHeight - ((value - domainMin) / domainSpan) * plotHeight;
      return { x, y, value, label: months[i] ?? "" };
    });
  }, [domainMin, domainSpan, months, plotHeight, plotWidth, values]);

  const line = linePath(points);
  const baseline = PAD.top + plotHeight;
  const area =
    points.length > 1
      ? `${line} L ${points[points.length - 1].x.toFixed(1)} ${baseline.toFixed(1)} L ${points[0].x.toFixed(1)} ${baseline.toFixed(1)} Z`
      : "";
  const active = activeIndex == null ? points[points.length - 1] : points[activeIndex];
  const showEvery = months.length > 18 ? 3 : months.length > 12 ? 2 : 1;
  const label = `${metricLabel} chart. Latest value ${active ? compact(active.value) : "none"}.`;

  function handlePointer(clientX: number, left: number) {
    if (!points.length) return;
    const localX = clamp(clientX - left, PAD.left, PAD.left + plotWidth);
    const ratio = plotWidth <= 0 ? 0 : (localX - PAD.left) / plotWidth;
    setActiveIndex(Math.round(ratio * (points.length - 1)));
  }

  if (!hasData) {
    return (
      <div className="ks-chart-surface flex min-h-[260px] flex-1 items-center justify-center rounded-xl px-3 pb-2 pt-3">
        <span className="font-mono text-xs text-dim">{emptyLabel}</span>
      </div>
    );
  }

  return (
    <div ref={ref} className="ks-chart-surface relative flex min-h-[260px] flex-1 rounded-xl px-3 pb-2 pt-3">
      <svg
        width={chartWidth}
        height={chartHeight}
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        role="img"
        aria-label={label}
        className="block h-full w-full"
        onPointerMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          handlePointer(e.clientX, rect.left);
        }}
        onPointerLeave={() => setActiveIndex(null)}
      >
        <defs>
          <linearGradient id={`${gradId}-area`} x1="0" y1={PAD.top} x2="0" y2={baseline} gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {yTicks.map((tick) => {
          const y = PAD.top + plotHeight - ((tick - domainMin) / domainSpan) * plotHeight;
          return (
            <g key={tick}>
              <line x1={PAD.left} y1={y} x2={chartWidth - PAD.right} y2={y} stroke="rgba(255,255,255,0.07)" strokeWidth="1" />
              <text x={PAD.left - 10} y={y + 4} textAnchor="end" className="fill-dim font-mono text-[10px]">
                {compact(tick)}
              </text>
            </g>
          );
        })}

        {area && <path d={area} fill={`url(#${gradId}-area)`} />}
        {points.length > 1 && (
          <path d={line} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        )}

        {points.map((p, i) => (
          <text
            key={`${p.label}-${i}`}
            x={p.x}
            y={chartHeight - 8}
            textAnchor={i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"}
            className="fill-dim font-mono text-[10px]"
          >
            {i % showEvery === 0 || i === points.length - 1 ? p.label : ""}
          </text>
        ))}

        {active && (
          <g>
            <line x1={active.x} y1={PAD.top} x2={active.x} y2={baseline} stroke="rgba(255,255,255,0.16)" strokeWidth="1" />
            <circle cx={active.x} cy={active.y} r="4" fill="var(--accent)" stroke="#08080a" strokeWidth="2" />
            <g transform={`translate(${clamp(active.x + 12, PAD.left, chartWidth - 136)}, ${clamp(active.y - 34, PAD.top, chartHeight - 72)})`}>
              <rect width="124" height="48" rx="8" fill="#101014" stroke="rgba(255,255,255,0.12)" />
              <text x="10" y="19" className="fill-muted font-mono text-[10px]">
                {active.label}
              </text>
              <text x="10" y="37" className="fill-fg font-mono text-[15px] font-semibold">
                {compact(active.value)}
              </text>
            </g>
          </g>
        )}

        <rect
          x={PAD.left}
          y={PAD.top}
          width={plotWidth}
          height={plotHeight}
          fill="transparent"
          className="cursor-crosshair"
        />
      </svg>
    </div>
  );
}
