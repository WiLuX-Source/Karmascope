import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Header } from "./components/Header";
import { Controls, type ControlsState } from "./components/Controls";
import { ProfileHeader } from "./components/ProfileHeader";
import { KpiTiles } from "./components/KpiTiles";
import { ActivityChart } from "./components/ActivityChart";
import { Panel } from "./components/Panel";
import { BarList } from "./components/BarList";
import { BarListSkeleton, ChartSkeleton, RecentSkeleton, RowsSkeleton } from "./components/Skeleton";
import { Flairs } from "./components/Flairs";
import { Composition } from "./components/Composition";
import { RecentActivity } from "./components/RecentActivity";
import { RateLimitToast } from "./components/RateLimitToast";
import { Loading, ErrorNote } from "./components/State";
import type { RedditKind } from "./lib/userRoute";
import {
  useUser,
  useActivity,
  useSubreddits,
  useInteractions,
  useFlairs,
  useRecent,
} from "./hooks/useProfile";

interface AppProps {
  username: string;
  onHandleSubmit: (kind: RedditKind, value: string) => void;
}

export function App({ username, onHandleSubmit }: AppProps) {
  const qc = useQueryClient();
  const hasUsername = username.length > 0;
  const [controls, setControls] = useState<ControlsState>({
    range: "12M",
    metric: "Both",
    sort: "Newest",
    showInteractions: true,
  });
  const user = useUser(username);
  const meta = user.data?._meta;
  const earliest = meta ? Math.min(meta.earliest_post_at, meta.earliest_comment_at) : undefined;
  const lastActive = meta ? Math.max(meta.last_post_at, meta.last_comment_at) : undefined;
  const activity = useActivity(username, earliest, lastActive);
  const subs = useSubreddits(username);
  const interactions = useInteractions(username, controls.showInteractions);
  const flairs = useFlairs(username);
  const recent = useRecent(username, controls.sort);

  const communities = subs.data?.length;
  const subRows = (subs.data ?? []).slice(0, 8).map((s) => ({
    name: `r/${s.subreddit}`,
    count: s.count,
    href: `https://www.reddit.com/r/${s.subreddit}`,
  }));
  const interactionRows = (interactions.data ?? []).slice(0, 6).map((i) => ({
    name: `u/${i.username}`,
    count: i.count,
    href: `https://www.reddit.com/user/${i.username}`,
  }));

  const syncing =
    hasUsername && (user.isFetching || activity.isFetching || subs.isFetching || recent.isFetching);

  function handleRescan() {
    qc.invalidateQueries();
  }

  return (
    <div className="ks-page relative min-h-screen">
      <div className="ks-grid" />
      <RateLimitToast />

      <Header
        kind="user"
        handle={username}
        onSubmit={onHandleSubmit}
        onRescan={handleRescan}
        syncing={syncing}
      />

      <main
        className="relative mx-auto flex max-w-[1340px] flex-col gap-3.5 px-4 pb-[60px] pt-[22px] sm:px-[26px]"
      >
        <Controls value={controls} onChange={(next) => setControls((c) => ({ ...c, ...next }))} />

        {!hasUsername ? (
          <StartState range={controls.range} metric={controls.metric} />
        ) : user.isLoading ? (
          <div className="flex justify-center py-[60px]">
            <Loading label={`fetching u/${username}…`} />
          </div>
        ) : user.error ? (
          <div className="rounded-2xl border border-[rgb(255_122_110_/_0.25)] bg-[rgb(255_122_110_/_0.06)] px-[26px] py-6">
            <ErrorNote error={user.error} />
          </div>
        ) : user.data ? (
          <>
            <ProfileHeader user={user.data} communities={communities} />

            <KpiTiles user={user.data} communities={communities} />

            <div className="flex flex-wrap gap-3.5">
              <ActivityChart
                range={controls.range}
                metric={controls.metric}
                data={activity.data}
                isLoading={activity.isLoading}
                error={activity.error}
              />
              <Panel
                title="Top communities"
                endpoint="/api/users/interactions/subreddits"
                minWidth={260}
                isLoading={subs.isLoading}
                error={subs.error}
                empty={subRows.length === 0}
                emptyLabel="No community data"
                skeleton={<BarListSkeleton rows={8} />}
              >
                <BarList rows={subRows} />
              </Panel>
            </div>

            <div className="flex flex-wrap gap-3.5">
              {controls.showInteractions && (
                <Panel
                  title="Top interactions"
                  endpoint="/api/users/interactions/users"
                  minWidth={260}
                  isLoading={interactions.isLoading}
                  error={interactions.error}
                  empty={!interactions.isLoading && !interactions.error && interactionRows.length === 0}
                  emptyLabel="No interaction data"
                  skeleton={<BarListSkeleton rows={6} />}
                >
                  <BarList rows={interactionRows} />
                </Panel>
              )}

              <Flairs
                flairs={flairs.data}
                isLoading={flairs.isLoading}
                error={flairs.error}
              />

              <Composition user={user.data} communities={communities} />
            </div>

            <RecentActivity
              sort={controls.sort}
              items={recent.data}
              isLoading={recent.isLoading}
              error={recent.error}
            />
          </>
        ) : null}

        <div className="pt-1.5 text-center font-mono text-[11px] text-faint">
          karmascope · data via arctic-shift.photon-reddit.com · live data · not affiliated with reddit
        </div>
      </main>
    </div>
  );
}

function StartState({ range, metric }: Pick<ControlsState, "range" | "metric">) {
  const metricWord = metric === "Both" ? "posts + comments" : metric.toLowerCase();

  return (
    <div className="ks-skeleton-paused relative flex flex-col gap-3.5">
      <div
        className="pointer-events-none absolute left-1/2 top-[42%] z-10 flex min-h-[118px] w-[calc(100%-32px)] max-w-[980px] -translate-x-1/2 -translate-y-1/2 items-center justify-center overflow-hidden rounded-[14px] border border-border bg-[image:var(--card-bg)] px-6 py-6 shadow-[0_22px_70px_rgb(0_0_0_/_0.45)] backdrop-blur-[10px]"
      >
        <p className="m-0 whitespace-nowrap text-center font-mono text-[16px] font-semibold leading-[1.25] tracking-normal text-soft sm:text-[24px] lg:text-[30px]">
          Search an username with the search bar above
        </p>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3.5">
        {["Total karma", "Posts", "Comments", "Communities"].map((label) => (
          <div
            key={label}
            className="rounded-[14px] border border-border bg-[image:var(--card-bg)] px-[18px] py-4"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-subtle">
                {label}
              </span>
              <span className="font-mono text-[10px] text-faint">waiting</span>
            </div>
            <div className="mt-3.5 font-mono text-[27px] font-semibold leading-none tracking-normal text-muted-3">
              --
            </div>
            <div className="mt-2.5 truncate whitespace-nowrap text-[11px] text-dim">
              Enter a username to calculate
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3.5">
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
          <ChartSkeleton />
        </div>

        <Panel
          title="Top communities"
          endpoint="/api/users/interactions/subreddits"
          minWidth={260}
          isLoading
          skeleton={<BarListSkeleton rows={8} />}
        >
          <BarList rows={[]} />
        </Panel>
      </div>

      <div className="flex flex-wrap gap-3.5">
        <Panel
          title="Top interactions"
          endpoint="/api/users/interactions/users"
          minWidth={260}
          isLoading
          skeleton={<BarListSkeleton rows={6} />}
        >
          <BarList rows={[]} />
        </Panel>

        <Panel
          title="Top flairs"
          endpoint="/api/users/flairs"
          isLoading
          skeleton={<RowsSkeleton rows={5} />}
        >
          <BarList rows={[]} />
        </Panel>

        <Panel
          title="Contribution split"
          endpoint="/api/users/search"
          isLoading
          skeleton={<RowsSkeleton rows={4} />}
        >
          <BarList rows={[]} />
        </Panel>
      </div>

      <div className="ks-card">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <span className="ks-label">Recent activity</span>
          <div className="flex flex-wrap items-center justify-end gap-[7px]">
            <div className="ks-glass-control flex gap-0.5 rounded-[9px] p-[3px]">
              {["All", "Posts", "Comments"].map((label, i) => (
                <span
                  key={label}
                  className={`rounded-[7px] px-3 py-[5px] text-xs font-medium ${
                    i === 0 ? "bg-accent-soft text-accent" : "text-muted-3"
                  }`}
                >
                  {label}
                </span>
              ))}
            </div>
            <span className="font-mono text-xs text-dim">sort=created_utc · sort=desc</span>
          </div>
        </div>
        <div className="ks-endpoint">/api/posts/search · /api/comments/search</div>
        <RecentSkeleton />
      </div>
    </div>
  );
}
