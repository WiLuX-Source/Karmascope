function SkeletonBox({ className = "" }: { className?: string }) {
  return <div className={`ks-skeleton ${className}`} />;
}

const chartBars = [
  "h-[40%]",
  "h-[62%]",
  "h-[48%]",
  "h-[78%]",
  "h-[55%]",
  "h-[90%]",
  "h-[70%]",
  "h-[96%]",
  "h-[60%]",
  "h-[84%]",
  "h-[72%]",
  "h-full",
];

const barLabelWidths = ["w-[90px]", "w-[82px]", "w-[74px]", "w-[66px]", "w-[58px]", "w-[50px]", "w-[42px]", "w-[34px]"];
const barFillWidths = ["w-[85%]", "w-[74%]", "w-[63%]", "w-[52%]", "w-[41%]", "w-[30%]", "w-[19%]", "w-[12%]"];
const rowLabelWidths = ["w-[80px]", "w-[74px]", "w-[68px]", "w-[62px]", "w-[56px]"];
const rowValueWidths = ["w-[50px]", "w-[56px]", "w-[62px]", "w-[68px]", "w-[74px]"];
const recentTitleWidths = ["w-[88%]", "w-[81%]", "w-[74%]", "w-[67%]", "w-[60%]", "w-[53%]"];

// Activity chart placeholder: chart-shaped panel with a faint baseline.
export function ChartSkeleton() {
  return (
    <div className="ks-chart-surface flex min-h-[220px] flex-1 flex-col justify-end gap-3.5 rounded-xl px-3 pb-2 pt-3">
      <div className="flex flex-1 items-end gap-2.5 px-1 pt-2.5">
        {chartBars.map((height, i) => (
          <SkeletonBox key={i} className={`w-full rounded ${height}`} />
        ))}
      </div>
      <div className="flex justify-between px-1">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonBox key={i} className="h-2 w-[22px]" />
        ))}
      </div>
    </div>
  );
}

// Label + progress bar rows (top communities / interactions).
export function BarListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="mt-[18px] flex flex-col gap-[13px]">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i}>
          <div className="mb-1.5 flex justify-between">
            <SkeletonBox className={`h-[11px] ${barLabelWidths[i] ?? "w-[34px]"}`} />
            <SkeletonBox className="h-[11px] w-7" />
          </div>
          <SkeletonBox className={`h-1.5 rounded ${barFillWidths[i] ?? "w-[12%]"}`} />
        </div>
      ))}
    </div>
  );
}

// Two-column rows (flairs / composition stats).
export function RowsSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="mt-2.5 flex flex-col">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center justify-between gap-3 border-t border-border-soft py-[11px]"
        >
          <SkeletonBox className={`h-3 ${rowLabelWidths[i] ?? "w-14"}`} />
          <SkeletonBox className={`h-[18px] rounded-md ${rowValueWidths[i] ?? "w-[74px]"}`} />
        </div>
      ))}
    </div>
  );
}

// Recent activity rows (score + text + tag).
export function RecentSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="mt-2 flex flex-col">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3.5 border-t border-border-soft py-[13px]"
        >
          <div className="flex w-[54px] flex-none flex-col items-center gap-[5px]">
            <SkeletonBox className="h-[11px] w-[11px] rounded-[3px]" />
            <SkeletonBox className="h-3.5 w-[30px]" />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <SkeletonBox className={`h-3.5 ${recentTitleWidths[i] ?? "w-[53%]"}`} />
            <SkeletonBox className="h-[11px] w-[32%]" />
          </div>
          <SkeletonBox className="h-5 w-[52px] rounded-md" />
        </div>
      ))}
    </div>
  );
}
