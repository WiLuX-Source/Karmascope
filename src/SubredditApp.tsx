import { useState, type CSSProperties } from "react";
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
  const subscriberSeries = useSubredditActivity(subreddit, "Subscribers");
  const wikis = useSubredditWikis(subreddit);
  const topPosts = useSubredditTopPosts(subreddit, postWindow);
  const contributors = useSubredditContributors(subreddit);
  const syncing =
    sub.isFetching ||
    activity.isFetching ||
    subscriberSeries.isFetching ||
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
            <SubredditKpis
              subreddit={sub.data}
              subscriberCount={latestPositiveValue(subscriberSeries.data?.values)}
              wikiCount={wikis.data?.length}
              authorCount={contributors.data?.length}
            />

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
                <div className="ks-endpoint">/api/posts/search · client aggregate</div>
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
          karmascope · data via arctic-shift.photon-reddit.com · live data · not affiliated with reddit
        </div>
      </main>
    </div>
  );
}

function latestPositiveValue(values: number[] | undefined) {
  if (!values) return undefined;
  for (let i = values.length - 1; i >= 0; i--) {
    const value = values[i];
    if (value > 0) return value;
  }
  return undefined;
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
  const bannerImage = [
    mediaUrl(subreddit.banner_background_image),
    mediaUrl(subreddit.banner_img),
    mediaUrl(subreddit.mobile_banner_image),
  ].find(Boolean);
  const mobileBannerImage = mediaUrl(subreddit.mobile_banner_image) ?? bannerImage;
  const bannerColor = hexColor(subreddit.banner_background_color, subreddit.primary_color, subreddit.key_color) ?? "#141418";
  const accentColor = hexColor(subreddit.key_color, subreddit.primary_color, subreddit.banner_background_color) ?? "#ff4500";
  const bannerStyle: CSSProperties = {
    background: `radial-gradient(circle at 18% 18%, ${accentColor}55, transparent 34%), linear-gradient(135deg, ${bannerColor}, #101014 72%)`,
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-[#101014] shadow-[0_22px_70px_rgb(0_0_0_/_0.28)]">
      <div className="absolute inset-0" style={bannerStyle} />
      {bannerImage ? (
        <picture className="absolute inset-0 block">
          {mobileBannerImage ? <source media="(max-width: 640px)" srcSet={mobileBannerImage} /> : null}
          <img
            src={bannerImage}
            alt=""
            aria-hidden="true"
            className="h-full w-full object-cover opacity-75 saturate-[1.08]"
          />
        </picture>
      ) : null}
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgb(0_0_0_/_0.10),rgb(0_0_0_/_0.52)_48%,rgb(0_0_0_/_0.86)),linear-gradient(90deg,rgb(0_0_0_/_0.72),rgb(0_0_0_/_0.22)_58%,rgb(0_0_0_/_0.48))]" />
      <div className="relative flex min-h-[230px] flex-col justify-end gap-5 px-5 pb-5 pt-20 [text-shadow:0_1px_18px_rgb(0_0_0_/_0.75)] sm:min-h-[246px] sm:px-6 sm:py-6">
        <div className="flex flex-wrap items-end gap-4 sm:gap-[22px]">
          <a
            href={redditUrl}
            target="_blank"
            rel="noopener noreferrer"
            title={`Open r/${subreddit.display_name} on reddit`}
            className="relative block h-[72px] w-[72px] flex-none cursor-pointer sm:h-[82px] sm:w-[82px]"
          >
            <div
              className="absolute -inset-[3px] rounded-full opacity-95"
              style={{ background: `conic-gradient(from 220deg, ${accentColor}, ${accentColor}88, ${accentColor})` }}
            />
            <SubredditLogo subreddit={subreddit} />
          </a>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <a
                href={redditUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="cursor-pointer break-words text-[24px] font-semibold leading-tight tracking-normal text-white no-underline hover:text-accent sm:text-[30px]"
              >
                r/{subreddit.display_name}
              </a>
              <span
                className={`rounded-md border px-2 py-0.5 text-[11px] font-medium backdrop-blur ${
                  subreddit.over18
                    ? "border-[rgb(255_122_110_/_0.34)] bg-[rgb(255_122_110_/_0.16)] text-[#ff948b]"
                    : "border-[rgb(61_220_151_/_0.32)] bg-[rgb(61_220_151_/_0.16)] text-[#64ecb3]"
                }`}
              >
                {subreddit.over18 ? "NSFW" : "SFW"}
              </span>
            </div>
            <div className="mt-2 max-w-[760px] text-[13px] leading-relaxed text-white/[0.82] sm:text-[14px]">{description}</div>
          </div>
          <div className="flex flex-wrap gap-[18px] rounded-xl border border-white/10 bg-black/[0.35] px-3.5 py-3 backdrop-blur-md sm:ml-auto sm:gap-[24px]">
            <Stat label="Created" value={shortDate(created)} />
          </div>
        </div>
        {subreddit.title && subreddit.title !== description ? (
          <div className="max-w-[760px] truncate border-l-2 border-white/20 pl-3 text-[12px] text-white/[0.62]">
            {subreddit.title}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function hexColor(...values: Array<string | undefined>) {
  for (const value of values) {
    const color = value?.trim();
    if (!color || !/^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(color)) continue;
    if (color.length === 4) {
      return `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`;
    }
    return color.slice(0, 7);
  }
}

function mediaUrl(value: string | null | undefined) {
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
          width={82}
          height={82}
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
  subscriberCount,
  wikiCount,
  authorCount,
}: {
  subreddit: SubredditRecord;
  subscriberCount: number | undefined;
  wikiCount: number | undefined;
  authorCount: number | undefined;
}) {
  const hasSeriesSubscriberCount = subscriberCount != null;
  const tiles: Tile[] = [
    {
      label: "Subscribers",
      field: "subscribers",
      value: num(subscriberCount ?? subreddit.subscribers),
      sub: hasSeriesSubscriberCount
        ? "latest archived subscriber statistic"
        : "latest archived subreddit snapshot",
    },
    {
      label: "Posts archived",
      field: "num_posts",
      value: num(subreddit._meta.num_posts),
      sub: "all submissions on record",
    },
    {
      label: "Comments archived",
      field: "num_comments",
      value: num(subreddit._meta.num_comments),
      sub: "all comments on record",
    },
    {
      label: "Recent authors",
      field: "authors / sample",
      value: authorCount == null ? "..." : num(authorCount),
      sub: `${wikiCount == null ? "..." : num(wikiCount)} wiki pages indexed`,
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
  const showExactValues = metric === "Subscribers";

  let body;
  if (isLoading || error) body = <ChartSkeleton />;
  else {
    body = (
      <TimeSeriesAreaChart
        months={shownMonths}
        values={series}
        metricLabel={metric}
        valueFormatter={showExactValues ? num : undefined}
        yAxisWidth={showExactValues ? 78 : undefined}
      />
    );
  }

  return (
    <div className="ks-card flex min-w-0 flex-[1.9_1_380px] flex-col">
      <div className="mb-1 flex items-center justify-between gap-3">
        <span className="ks-label">{metric === "Subscribers" ? "Subscriber growth" : `${metric} over time`}</span>
        <span className="font-mono text-xs text-dim">
          {metric.toLowerCase()} / month · {range}
        </span>
      </div>
      <div className="ks-endpoint mb-3 mt-0">/api/time_series · key=r/subreddit</div>
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
      <div className="ks-endpoint">/api/subreddits/wikis/list</div>
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
      <div className="ks-endpoint">/api/subreddits/search · _meta</div>
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
      <div className="ks-endpoint">/api/posts/search · subreddit={subreddit}</div>
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
