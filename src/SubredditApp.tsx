import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Header } from "./components/Header";
import { RateLimitToast } from "./components/RateLimitToast";
import { BarList } from "./components/BarList";
import { ChartSkeleton, RowsSkeleton, BarListSkeleton } from "./components/Skeleton";
import { Empty, ErrorNote, Loading } from "./components/State";
import { TimeSeriesAreaChart } from "./components/TimeSeriesAreaChart";
import { compact, num, relTime, shortDate } from "./lib/format";
import type { Range } from "./hooks/useProfile";
import type { RedditKind } from "./lib/userRoute";
import {
  SUBREDDIT_RANGE_MONTHS,
  useSubreddit,
  useSubredditActivity,
  useSubredditContributors,
  useSubredditTopPosts,
  useSubredditWikis,
  type PostWindow,
  type SubredditMetric,
} from "./hooks/useSubreddit";
import type { SubredditRecord, WikiPage } from "./api/arctic";

interface SubredditAppProps {
  subreddit: string;
  onHandleSubmit: (kind: RedditKind, value: string) => void;
}

interface Tile {
  label: string;
  field: string;
  value: string;
  sub: string;
}

const subredditMetrics = ["Subscribers", "Posts", "Comments", "Score"] as const;
const ranges = ["6M", "12M", "24M"] as const;
const postWindows = ["All", "Year", "Month"] as const;

export function SubredditApp({ subreddit, onHandleSubmit }: SubredditAppProps) {
  const qc = useQueryClient();
  const [range, setRange] = useState<Range>("12M");
  const [metric, setMetric] = useState<SubredditMetric>("Subscribers");
  const [postWindow, setPostWindow] = useState<PostWindow>("Year");

  const sub = useSubreddit(subreddit);
  const activity = useSubredditActivity(subreddit, metric);
  const wikis = useSubredditWikis(subreddit);
  const topPosts = useSubredditTopPosts(subreddit, postWindow);
  const contributors = useSubredditContributors(subreddit);
  const hasLiveSnapshot = sub.data?._sources?.snapshot === "reddit-live";
  const sourceLabel = hasLiveSnapshot ? "reddit live + arctic" : "arctic-shift";
  const footerSource = hasLiveSnapshot
    ? "live stats via public reddit data · archive via arctic-shift.photon-reddit.com"
    : "archive via arctic-shift.photon-reddit.com";
  const syncing =
    sub.isFetching ||
    activity.isFetching ||
    wikis.isFetching ||
    topPosts.isFetching ||
    contributors.isFetching;

  function handleRescan() {
    qc.invalidateQueries();
  }

  return (
    <div className="ks-page relative min-h-screen">
      <div className="ks-grid" />
      <RateLimitToast />

      <Header
        kind="subreddit"
        handle={subreddit}
        onSubmit={onHandleSubmit}
        onRescan={handleRescan}
        syncing={syncing}
        sourceLabel={sourceLabel}
      />

      <main className="relative mx-auto flex max-w-[1340px] flex-col gap-3.5 px-4 pb-[60px] pt-[22px] sm:px-[26px]">
        <SubredditControls
          range={range}
          metric={metric}
          onRangeChange={setRange}
          onMetricChange={setMetric}
        />

        {sub.isLoading ? (
          <div className="flex justify-center py-[60px]">
            <Loading label={`fetching r/${subreddit}...`} />
          </div>
        ) : sub.error ? (
          <div className="rounded-2xl border border-[rgb(255_122_110_/_0.25)] bg-[rgb(255_122_110_/_0.06)] px-[26px] py-6">
            <ErrorNote error={sub.error} />
          </div>
        ) : sub.data ? (
          <>
            <SubredditHeader subreddit={sub.data} />
            <SubredditKpis subreddit={sub.data} wikiCount={wikis.data?.length} authorCount={contributors.data?.length} />

            <div className="flex flex-wrap gap-3.5">
              <SubredditActivityChart
                range={range}
                metric={metric}
                months={activity.data?.months}
                values={activity.data?.values}
                isLoading={activity.isLoading}
                error={activity.error}
              />
              <div className="ks-card min-w-0 flex-[1_1_260px]">
                <span className="ks-label">Top contributors</span>
                <div className="ks-endpoint">Arctic /api/posts/search · client aggregate</div>
                {contributors.isLoading || contributors.error ? (
                  <BarListSkeleton rows={8} />
                ) : contributors.data?.length ? (
                  <BarList rows={contributors.data} />
                ) : (
                  <Empty label="No contributor data" />
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-stretch gap-3.5">
              <WikiGrid wikis={wikis.data} isLoading={wikis.isLoading} />
              <ContentSplit subreddit={sub.data} />
            </div>

            <TopPosts
              subreddit={subreddit}
              window={postWindow}
              onWindowChange={setPostWindow}
              posts={topPosts.data}
              isLoading={topPosts.isLoading}
              error={topPosts.error}
            />
          </>
        ) : null}

        <div className="pt-1.5 text-center font-mono text-[11px] text-faint">
          karmascope · {footerSource} · not affiliated with reddit
        </div>
      </main>
    </div>
  );
}

function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="ks-glass-control flex gap-0.5 rounded-lg p-0.5">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={`cursor-pointer rounded-md border-0 px-2.5 py-[5px] font-mono text-xs ${
            opt === value ? "bg-accent font-semibold text-white" : "bg-transparent font-normal text-muted"
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

function SubredditControls({
  range,
  metric,
  onRangeChange,
  onMetricChange,
}: {
  range: Range;
  metric: SubredditMetric;
  onRangeChange: (range: Range) => void;
  onMetricChange: (metric: SubredditMetric) => void;
}) {
  const label = "font-mono text-[10px] uppercase tracking-[0.08em] text-dim";

  return (
    <div className="flex flex-wrap items-center gap-[22px] rounded-xl border border-border bg-[image:var(--card-bg)] px-4 py-3">
      <div className="flex items-center gap-[9px]">
        <span className={label}>Range</span>
        <Segmented options={ranges} value={range} onChange={onRangeChange} />
      </div>
      <div className="flex items-center gap-[9px]">
        <span className={label}>Metric</span>
        <Segmented options={subredditMetrics} value={metric} onChange={onMetricChange} />
      </div>
    </div>
  );
}

function SubredditHeader({ subreddit }: { subreddit: SubredditRecord }) {
  const created = subreddit.created_utc || Math.min(subreddit._meta.earliest_post, subreddit._meta.earliest_comment);
  const description = subreddit.public_description || subreddit.title || "No public description archived.";
  const redditUrl = `https://www.reddit.com/r/${subreddit.display_name}`;

  return (
    <div className="flex flex-wrap items-center gap-[22px] rounded-2xl border-4 border-double border-border bg-[image:var(--card-bg)] px-6 py-5">
      <a
        href={redditUrl}
        target="_blank"
        rel="noopener noreferrer"
        title={`Open r/${subreddit.display_name} on reddit`}
        className="relative block h-[62px] w-[62px] flex-none cursor-pointer"
      >
        <div className="absolute -inset-[3px] rounded-full bg-ring opacity-90" />
        <SubredditLogo subreddit={subreddit} />
      </a>
      <div className="min-w-[220px] flex-1">
        <div className="flex flex-wrap items-center gap-2.5">
          <a
            href={redditUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="cursor-pointer text-[22px] font-semibold tracking-normal text-inherit no-underline hover:text-accent"
          >
            r/{subreddit.display_name}
          </a>
          <span
            className={`rounded-md border px-2 py-0.5 text-[11px] font-medium ${
              subreddit.over18
                ? "border-[rgb(255_122_110_/_0.25)] bg-[rgb(255_122_110_/_0.08)] text-[#ff7a6e]"
                : "border-[rgb(61_220_151_/_0.22)] bg-[rgb(61_220_151_/_0.12)] text-[#3ddc97]"
            }`}
          >
            {subreddit.over18 ? "NSFW" : "SFW"}
          </span>
        </div>
        <div className="mt-1.5 max-w-[720px] text-[13px] leading-normal text-muted-3">{description}</div>
      </div>
      <div className="ml-auto flex flex-wrap gap-[26px]">
        <Stat label="Created" value={shortDate(created)} />
      </div>
    </div>
  );
}

function mediaUrl(value: string | undefined) {
  const url = value?.replace(/&amp;/g, "&").trim();
  return url || undefined;
}

function SubredditLogo({ subreddit }: { subreddit: SubredditRecord }) {
  const [srcIndex, setSrcIndex] = useState(0);
  const urls = [mediaUrl(subreddit.community_icon), mediaUrl(subreddit.icon_img)].filter(Boolean) as string[];
  const src = urls[srcIndex];

  return (
    <div className="absolute inset-0 flex items-center justify-center overflow-hidden rounded-full bg-[#0d0d10] font-mono text-base font-semibold text-accent">
      {src ? (
        <img
          src={src}
          alt={`r/${subreddit.display_name} logo`}
          width={62}
          height={62}
          onError={() => setSrcIndex((i) => i + 1)}
          className="block h-full w-full object-cover"
        />
      ) : (
        "r/"
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-[0.07em] text-subtle">{label}</div>
      <div className="mt-[3px] font-mono text-[15px]">{value}</div>
    </div>
  );
}

function SubredditKpis({
  subreddit,
  wikiCount,
  authorCount,
}: {
  subreddit: SubredditRecord;
  wikiCount: number | undefined;
  authorCount: number | undefined;
}) {
  const subscriberSource =
    subreddit._sources?.subscribers === "reddit-live"
      ? "Reddit live snapshot"
      : "Arctic archived snapshot";
  const activeCount = subreddit.active_user_count ?? subreddit.accounts_active;
  const tiles: Tile[] = [
    {
      label: "Subscribers",
      field: "subscribers",
      value: num(subreddit.subscribers),
      sub: subscriberSource,
    },
    {
      label: "Active users",
      field: "active_user_count",
      value: num(activeCount),
      sub: activeCount == null ? "not available from live source" : "Reddit live snapshot",
    },
    {
      label: "Posts archived",
      field: "num_posts",
      value: num(subreddit._meta.num_posts),
      sub: subreddit._sources?.archive === "arctic" ? "all submissions on Arctic record" : "archive unavailable",
    },
    {
      label: "Comments archived",
      field: "num_comments",
      value: num(subreddit._meta.num_comments),
      sub: subreddit._sources?.archive === "arctic" ? "all comments on Arctic record" : "archive unavailable",
    },
    {
      label: "Recent authors",
      field: "authors / sample",
      value: authorCount == null ? "..." : num(authorCount),
      sub: `${wikiCount == null ? "..." : num(wikiCount)} Arctic wiki pages indexed`,
    },
  ];

  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3.5">
      {tiles.map((tile) => (
        <div key={tile.label} className="rounded-[14px] border border-border bg-[image:var(--card-bg)] px-[18px] py-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-subtle">{tile.label}</span>
            <span className="font-mono text-[10px] text-faint">{tile.field}</span>
          </div>
          <div className="mt-3.5 font-mono text-[27px] font-semibold leading-none tracking-normal">{tile.value}</div>
          <div className="mt-2.5 truncate whitespace-nowrap text-[11px] text-dim">{tile.sub}</div>
        </div>
      ))}
    </div>
  );
}

function SubredditActivityChart({
  range,
  metric,
  months,
  values,
  isLoading,
  error,
}: {
  range: Range;
  metric: SubredditMetric;
  months: string[] | undefined;
  values: number[] | undefined;
  isLoading: boolean;
  error: unknown;
}) {
  const n = SUBREDDIT_RANGE_MONTHS[range];
  const shownMonths = (months ?? []).slice(-n);
  const series = (values ?? []).slice(-n);

  let body;
  if (isLoading || error) body = <ChartSkeleton />;
  else body = <TimeSeriesAreaChart months={shownMonths} values={series} metricLabel={metric} />;

  return (
    <div className="ks-card flex min-w-0 flex-[1.9_1_380px] flex-col">
      <div className="mb-1 flex items-center justify-between gap-3">
        <span className="ks-label">{metric === "Subscribers" ? "Subscriber growth" : `${metric} over time`}</span>
        <span className="font-mono text-xs text-dim">
          {metric.toLowerCase()} / month · {range}
        </span>
      </div>
      <div className="ks-endpoint mb-3 mt-0">Arctic /api/time_series · key=r/subreddit</div>
      {body}
    </div>
  );
}

function WikiGrid({ wikis, isLoading }: { wikis: WikiPage[] | undefined; isLoading: boolean }) {
  const wikiHref = (wiki: WikiPage) =>
    `https://www.reddit.com${wiki.name === "index" ? wiki.path.replace(/\/index\/?$/, "") : wiki.path}`;

  return (
    <div className="ks-card min-w-0 flex-[1.4_1_320px]">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <span className="ks-label">Wiki pages and paths</span>
        <span className="font-mono text-[11px] text-dim">{wikis?.length ?? "..."} pages</span>
      </div>
      <div className="ks-endpoint">Arctic /api/subreddits/wikis/list</div>
      {isLoading ? (
        <RowsSkeleton rows={8} />
      ) : wikis?.length ? (
        <div className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(215px,1fr))] gap-2">
          {wikis.map((wiki) => (
            <a
              key={wiki.path}
              href={wikiHref(wiki)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex cursor-pointer items-center gap-[11px] rounded-[10px] border border-border-soft bg-white/[0.022] px-3 py-2.5 text-inherit no-underline hover:border-accent-soft hover:bg-white/[0.05]"
            >
              <span className="flex flex-none text-accent">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3">
                  <path d="M3 1.5h4.6L11 4.9V12.5H3z" />
                  <path d="M7.4 1.5v3.4H11" />
                  <line x1="4.8" y1="7.4" x2="9" y2="7.4" />
                  <line x1="4.8" y1="9.6" x2="9" y2="9.6" />
                </svg>
              </span>
              <div className="min-w-0">
                <div className="truncate font-mono text-[13px] text-soft">{wiki.name}</div>
                <div className="mt-0.5 truncate font-mono text-[10px] text-dim">{wiki.path}</div>
              </div>
            </a>
          ))}
        </div>
      ) : (
        <Empty label="No wiki pages" />
      )}
    </div>
  );
}

function ContentSplit({ subreddit }: { subreddit: SubredditRecord }) {
  const posts = subreddit._meta.num_posts || 0;
  const comments = subreddit._meta.num_comments || 0;
  const total = Math.max(1, posts + comments);
  const postsPct = Math.round((posts / total) * 1000) / 10;
  const commentsPct = Math.round((comments / total) * 1000) / 10;
  const firstSeen = Math.min(subreddit._meta.earliest_post, subreddit._meta.earliest_comment);
  const updated = Math.max(subreddit._meta.num_posts_updated_at ?? 0, subreddit._meta.num_comments_updated_at ?? 0);

  return (
    <div className="ks-card min-w-0 flex-[1_1_240px]">
      <span className="ks-label">Content split</span>
      <div className="ks-endpoint">Arctic /api/subreddits/search · _meta</div>
      <div className="mt-4 flex h-[9px] overflow-hidden rounded-[5px]">
        <div style={{ width: `${postsPct}%` }} className="bg-accent" />
        <div style={{ width: `${commentsPct}%` }} className="bg-comment" />
      </div>
      <div className="mt-3 flex flex-wrap gap-[18px]">
        <Legend colorClass="bg-accent" label="Posts" pct={postsPct} />
        <Legend colorClass="bg-comment" label="Comments" pct={commentsPct} />
      </div>
      <div className="mt-2 flex flex-col">
        <StatRow label="First archived" value={shortDate(firstSeen)} />
        <StatRow label="Updated" value={updated ? relTime(updated) : "—"} />
        <StatRow label="Post share" value={`${postsPct}%`} />
        <StatRow label="Comment share" value={`${commentsPct}%`} />
      </div>
    </div>
  );
}

function Legend({ colorClass, label, pct }: { colorClass: string; label: string; pct: number }) {
  return (
    <div className="flex items-center gap-[7px] text-xs">
      <span className={`h-2 w-2 rounded-sm ${colorClass}`} />
      <span className="text-muted-2">{label}</span>
      <span className="font-mono text-muted-3">{pct}%</span>
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-t border-border-soft py-2.5">
      <span className="text-[13px] text-muted">{label}</span>
      <span className="font-mono text-sm text-fg">{value}</span>
    </div>
  );
}

function TopPosts({
  subreddit,
  window,
  onWindowChange,
  posts,
  isLoading,
  error,
}: {
  subreddit: string;
  window: PostWindow;
  onWindowChange: (window: PostWindow) => void;
  posts: ReturnType<typeof useSubredditTopPosts>["data"];
  isLoading: boolean;
  error: unknown;
}) {
  const windowLabel = window === "All" ? "latest archive sample" : window === "Year" ? "past year" : "past month";

  return (
    <div className="ks-card">
      <div className="flex flex-wrap items-center justify-between gap-3.5">
        <span className="ks-label">Top posts</span>
        <div className="flex flex-wrap items-center gap-[7px]">
          <Segmented options={postWindows} value={window} onChange={onWindowChange} />
          <span className="font-mono text-xs text-dim">rank=score · {windowLabel}</span>
        </div>
      </div>
      <div className="ks-endpoint">Arctic /api/posts/search · subreddit={subreddit}</div>
      {isLoading || error ? (
        <RowsSkeleton rows={6} />
      ) : posts?.length ? (
        <div className="mt-2 flex flex-col">
          {posts.map((post) => (
            <a
              key={post.id}
              href={post.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3.5 border-t border-border-soft py-[13px] text-inherit no-underline hover:bg-white/[0.018]"
            >
              <span className="w-[22px] flex-none text-right font-mono text-[13px] text-faint">{post.rank}</span>
              <div className="flex w-[54px] flex-none flex-col items-center">
                <svg width="11" height="11" viewBox="0 0 12 12">
                  <polygon points="6,1 11,8 1,8" fill="var(--accent)" />
                </svg>
                <span className="font-mono text-[15px] font-semibold text-accent">{compact(post.score)}</span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="line-clamp-1 text-[14px] leading-snug text-soft">{post.title}</div>
                <div className="mt-1 font-mono text-xs text-subtle">
                  u/{post.author} · {num(post.comments)} comments · {relTime(post.created_utc)}
                </div>
              </div>
              <span className="max-w-[150px] flex-none truncate rounded-md bg-white/[0.05] px-2 py-[3px] text-[11px] font-medium text-muted">
                {post.flair}
              </span>
            </a>
          ))}
        </div>
      ) : (
        <Empty label="No posts found" />
      )}
    </div>
  );
}
