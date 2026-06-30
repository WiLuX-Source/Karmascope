import { areaChart } from "../lib/svg";
import { RANGE_MONTHS, type ActivitySeries, type Metric, type Range } from "../hooks/useProfile";
import { Empty } from "./State";
import { ChartSkeleton } from "./Skeleton";

interface Props {
  range: Range;
  metric: Metric;
  data: ActivitySeries | undefined;
  isLoading: boolean;
  error: unknown;
}

export function ActivityChart({ range, metric, data, isLoading, error }: Props) {
  // The hook returns the full lifetime series; slice the last N months here so
  // changing range is instant (no refetch).
  const n = RANGE_MONTHS[range];
  const months = (data?.months ?? []).slice(-n);
  const postCounts = (data?.postCounts ?? []).slice(-n);
  const commentCounts = (data?.commentCounts ?? []).slice(-n);
  const series =
    metric === "Posts"
      ? postCounts
      : metric === "Comments"
        ? commentCounts
        : postCounts.map((p, i) => p + (commentCounts[i] ?? 0));

  let body;
  if (isLoading || error) body = <ChartSkeleton />;
  else if (!series.some((v) => v > 0))
    body = <Empty label="No archived activity in this range" />;
  else {
    const { linePath, areaPath, lastDot } = areaChart(series);
    const showEvery = months.length > 18 ? 3 : months.length > 12 ? 2 : 1;

    body = (
      <div className="ks-chart-surface flex min-h-[220px] flex-1 flex-col rounded-xl px-3 pb-2 pt-3">
        <svg
          width="100%"
          viewBox="0 0 780 210"
          preserveAspectRatio="none"
          className="block min-h-0 w-full flex-1"
        >
          {[14, 55.5, 97, 138.5, 180].map((y, i) => (
            <line
              key={y}
              x1="10"
              y1={y}
              x2="770"
              y2={y}
              stroke={`rgba(255,255,255,${i === 4 ? 0.08 : 0.05})`}
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
          ))}
          <path d={areaPath} fill="url(#areaGrad)" />
          <path
            d={linePath}
            fill="none"
            stroke="var(--accent)"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle
            cx={lastDot.cx}
            cy={lastDot.cy}
            r="3.6"
            fill="var(--accent)"
            stroke="#08080a"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />
          <defs>
            <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.28" />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>
        <div className="mt-2 flex justify-between px-0.5">
          {months.map((m, i) => (
            <span key={i} className="font-mono text-[10px] text-dim">
              {i % showEvery === 0 || i === months.length - 1 ? m : ""}
            </span>
          ))}
        </div>
      </div>
    );
  }

  const metricWord = metric === "Both" ? "posts + comments" : metric.toLowerCase();

  return (
    <div className="ks-card flex min-w-0 flex-[1.9_1_380px] flex-col">
      <div className="mb-1 flex items-center justify-between">
        <span className="ks-label">Activity over time</span>
        <span className="font-mono text-xs text-dim">
          {metricWord} / month · {range}
        </span>
      </div>
      <div className="ks-endpoint mb-3 mt-0">
        /api/posts/search/aggregate · /api/comments/search/aggregate
      </div>
      {body}
    </div>
  );
}
