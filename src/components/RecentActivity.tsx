import { useEffect, useState } from "react";
import { num, relTime } from "../lib/format";
import { Empty, ErrorNote } from "./State";
import { RecentSkeleton } from "./Skeleton";
import { RECENT_PAGE_SIZE, type RecentFilter, type RecentItem, type Sort } from "../hooks/useProfile";

interface Props {
  sort: Sort;
  filter: RecentFilter;
  onFilterChange: (filter: RecentFilter) => void;
  items: RecentItem[] | undefined;
  isLoading: boolean;
  isFetchingMore: boolean;
  canLoadMore: boolean;
  loadMore: () => Promise<unknown>;
  error: unknown;
}

const filters: RecentFilter[] = ["All", "Posts", "Comments"];

export function RecentActivity({
  sort,
  filter,
  onFilterChange,
  items,
  isLoading,
  isFetchingMore,
  canLoadMore,
  loadMore,
  error,
}: Props) {
  const rows = items ?? [];
  const [page, setPage] = useState(0);
  const [pendingPage, setPendingPage] = useState<number | null>(null);
  const pageCount = Math.max(1, Math.ceil(rows.length / RECENT_PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const visibleRows = rows.slice(
    currentPage * RECENT_PAGE_SIZE,
    currentPage * RECENT_PAGE_SIZE + RECENT_PAGE_SIZE,
  );
  const start = rows.length === 0 ? 0 : currentPage * RECENT_PAGE_SIZE + 1;
  const end = Math.min(rows.length, currentPage * RECENT_PAGE_SIZE + RECENT_PAGE_SIZE);
  const rangeLabel = `${rows.length}${canLoadMore ? "+" : ""} loaded · showing ${start}-${end}`;
  const atFirst = currentPage === 0;
  const atLoadedEnd = currentPage >= pageCount - 1;
  const atLast = atLoadedEnd && !canLoadMore;
  const backLabel = sort === "Newest" ? "Newer" : "Older";
  const forwardLabel = sort === "Newest" ? "Older" : "Newer";
  const loadingLabel = sort === "Newest" ? "Loading older" : "Loading newer";
  const pageLabel = `Page ${currentPage + 1}`;

  useEffect(() => {
    setPage(0);
    setPendingPage(null);
  }, [filter, sort]);

  useEffect(() => {
    setPage((value) => Math.min(value, pageCount - 1));
  }, [pageCount]);

  useEffect(() => {
    if (pendingPage == null || isFetchingMore) return;
    if (pendingPage < pageCount) {
      setPage(pendingPage);
      setPendingPage(null);
    } else if (!canLoadMore) {
      setPendingPage(null);
    }
  }, [canLoadMore, isFetchingMore, pageCount, pendingPage]);

  function handleNext() {
    if (!atLoadedEnd) {
      setPage((value) => Math.min(pageCount - 1, value + 1));
      return;
    }
    if (!canLoadMore || isFetchingMore) return;
    setPendingPage(currentPage + 1);
    void loadMore().catch(() => setPendingPage(null));
  }

  return (
    <div className="ks-card">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <span className="ks-label">Recent activity</span>
        <div className="flex flex-wrap items-center justify-end gap-[7px]">
          <div className="ks-glass-control flex gap-0.5 rounded-[9px] p-[3px]">
            {filters.map((option) => {
              const active = option === filter;
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => onFilterChange(option)}
                  className={`cursor-pointer rounded-[7px] border-0 px-3 py-[5px] text-xs font-medium ${
                    active ? "bg-accent-soft text-accent" : "bg-transparent text-muted-3"
                  }`}
                >
                  {option}
                </button>
              );
            })}
          </div>
          <span className="font-mono text-xs text-dim">
            sort=created_utc · {sort === "Newest" ? "sort=desc" : "sort=asc"}
          </span>
        </div>
      </div>
      <div className="ks-endpoint">/api/posts/search · /api/comments/search</div>

      {isLoading ? (
        <RecentSkeleton />
      ) : error ? (
        <ErrorNote error={error} />
      ) : rows.length === 0 ? (
        <Empty label="No recent activity" />
      ) : (
        <>
          <div className="mt-2 flex flex-col">
            {visibleRows.map((r) => (
              <a
                key={r.kind + r.id}
                href={r.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex cursor-pointer items-center gap-3.5 border-t border-border-soft py-[13px] text-inherit no-underline hover:bg-white/[0.02]"
              >
                <div className="flex w-[54px] flex-none flex-col items-center">
                  <svg width="11" height="11" viewBox="0 0 12 12">
                    <polygon points="6,1 11,8 1,8" fill="var(--accent)" />
                  </svg>
                  <span className="font-mono text-[15px] font-semibold text-accent">
                    {num(r.score)}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="overflow-hidden text-sm leading-[1.35] text-soft [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:1]">
                    {r.text}
                  </div>
                  <div className="mt-1 font-mono text-xs text-subtle">
                    r/{r.subreddit}
                    {r.comments != null ? ` · ${num(r.comments)} comments` : ""} ·{" "}
                    {relTime(r.created_utc)}
                  </div>
                </div>
                <span className="flex-none rounded-md bg-white/5 px-2 py-[3px] text-[11px] font-medium text-muted">
                  {r.kind}
                </span>
              </a>
            ))}
          </div>

          <div className="mt-3.5 flex flex-wrap items-center justify-between gap-3.5 border-t border-border-soft pt-3.5">
            <span className="font-mono text-xs text-subtle">{rangeLabel}</span>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setPage((value) => Math.max(0, value - 1))}
                disabled={atFirst}
                className="ks-glass-control flex cursor-pointer items-center gap-1.5 rounded-lg px-[11px] py-1.5 text-xs font-medium text-soft disabled:cursor-default disabled:text-faint"
              >
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <polyline points="7.5,2 3.5,6 7.5,10" />
                </svg>
                {backLabel}
              </button>
              <span className="flex min-w-[74px] items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 font-mono text-xs font-medium text-muted">
                {pageLabel}
              </span>
              <button
                type="button"
                onClick={handleNext}
                disabled={atLast || (atLoadedEnd && isFetchingMore)}
                className="ks-glass-control flex cursor-pointer items-center gap-1.5 rounded-lg px-[11px] py-1.5 text-xs font-medium text-soft disabled:cursor-default disabled:text-faint"
              >
                {atLoadedEnd && isFetchingMore ? loadingLabel : forwardLabel}
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <polyline points="4.5,2 8.5,6 4.5,10" />
                </svg>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
