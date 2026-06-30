import type { Metric, Range, Sort } from "../hooks/useProfile";

export interface ControlsState {
  range: Range;
  metric: Metric;
  sort: Sort;
  showInteractions: boolean;
}

interface Props {
  value: ControlsState;
  onChange: (next: Partial<ControlsState>) => void;
}

const groupLabel = "font-mono text-[10px] uppercase tracking-[0.08em] text-dim";

function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="ks-glass-control flex gap-0.5 rounded-lg p-0.5">
      {options.map((opt) => {
        const active = opt === value;
        return (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            className={`cursor-pointer rounded-md border-0 px-2.5 py-[5px] font-mono text-xs ${
              active ? "bg-accent font-semibold text-white" : "bg-transparent font-normal text-muted"
            }`}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

export function Controls({ value, onChange }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-[22px] rounded-xl border border-border bg-[image:var(--card-bg)] px-4 py-3">
      <div className="flex items-center gap-[9px]">
        <span className={groupLabel}>Range</span>
        <Segmented
          options={["6M", "12M", "24M"] as const}
          value={value.range}
          onChange={(range) => onChange({ range })}
        />
      </div>

      <div className="flex items-center gap-[9px]">
        <span className={groupLabel}>Metric</span>
        <Segmented
          options={["Both", "Posts", "Comments"] as const}
          value={value.metric}
          onChange={(metric) => onChange({ metric })}
        />
      </div>

      <div className="flex items-center gap-[9px]">
        <span className={groupLabel}>Recent</span>
        <Segmented
          options={["Newest", "Oldest"] as const}
          value={value.sort}
          onChange={(sort) => onChange({ sort })}
        />
      </div>

      <label className="ml-auto flex cursor-pointer items-center gap-[7px]">
        <input
          type="checkbox"
          checked={value.showInteractions}
          onChange={(e) => onChange({ showInteractions: e.target.checked })}
          className="ks-accent-checkbox"
        />
        <span className={`${groupLabel} text-muted`}>Interactions panel</span>
      </label>
    </div>
  );
}
