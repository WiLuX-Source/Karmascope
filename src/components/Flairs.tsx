import type { Flair } from "../api/arctic";
import { Panel } from "./Panel";
import { RowsSkeleton } from "./Skeleton";

interface Props {
  flairs: Flair[] | undefined;
  isLoading: boolean;
  error: unknown;
}

export function Flairs({ flairs, isLoading, error }: Props) {
  const rows = (flairs ?? []).slice(0, 6);
  return (
    <Panel
      title="Flairs by subreddit"
      endpoint="/api/users/aggregate_flairs"
      isLoading={isLoading}
      error={error}
      empty={rows.length === 0}
      emptyLabel="No flairs found"
      skeleton={<RowsSkeleton rows={5} />}
    >
      <div className="mt-2.5 flex flex-col">
        {rows.map((fl) => (
          <div
            key={fl.sub}
            className="flex items-center justify-between gap-3 border-t border-border-soft py-[11px]"
          >
            <span className="font-mono text-[13px] text-muted">{fl.sub}</span>
            <span
              className="max-w-[60%] truncate rounded-md border border-accent-soft bg-accent-soft px-[9px] py-0.5 text-xs font-medium text-accent"
            >
              {fl.flair}
            </span>
          </div>
        ))}
      </div>
    </Panel>
  );
}
