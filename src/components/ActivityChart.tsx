import { RANGE_MONTHS, type ActivitySeries, type Metric, type Range } from "../hooks/useProfile";
import { ChartSkeleton } from "./Skeleton";
import { TimeSeriesAreaChart } from "./TimeSeriesAreaChart";

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
  else body = <TimeSeriesAreaChart months={months} values={series} metricLabel={metric} />;

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
