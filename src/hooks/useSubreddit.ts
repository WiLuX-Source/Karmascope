import { useInfiniteQuery, useQuery, type InfiniteData } from "@tanstack/react-query";
import {
  fetchSubreddit,
  fetchSubredditPosts,
  fetchSubredditTimeSeries,
  fetchSubredditWikis,
  RateLimitError,
  type RawPost,
  type SubredditSeriesMetric,
} from "../api/arctic";
import type { Range } from "./useProfile";

export type SubredditMetric = SubredditSeriesMetric;
export type PostWindow = "All" | "Year" | "Month";
export const SUBREDDIT_RANGE_MONTHS: Record<Range, number> = { "6M": 6, "12M": 12, "24M": 24 };
const POST_SAMPLE_LIMIT = 100;
const TOP_POSTS_LIMIT = 5;

export interface SubredditActivitySeries {
  months: string[];
  values: number[];
}

export interface RankedPost {
  id: string;
  rank: string;
  score: number;
  title: string;
  author: string;
  comments: number;
  created_utc: number;
  flair: string;
  url: string;
}

export interface TopPostsPage {
  posts: RankedPost[];
  cursor?: string;
  hasMore: boolean;
}

interface TopPostsPageParam {
  cursor?: string;
  page: number;
}

const opts = {
  staleTime: Infinity,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
  retry: (count: number, err: unknown) => !(err instanceof RateLimitError) && count < 1,
} as const;

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

function afterForWindow(window: PostWindow) {
  if (window === "All") return undefined;
  const d = new Date();
  if (window === "Year") d.setUTCFullYear(d.getUTCFullYear() - 1);
  else d.setUTCMonth(d.getUTCMonth() - 1);
  return isoDate(d);
}

function monthLabel(sec: number) {
  const d = new Date(sec * 1000);
  const month = d.toLocaleString("en-US", { month: "short" });
  return d.getUTCMonth() === 0 ? `${month} '${String(d.getUTCFullYear()).slice(2)}` : month;
}

function postUrl(post: RawPost) {
  return post.permalink
    ? `https://www.reddit.com${post.permalink}`
    : `https://www.reddit.com/r/${post.subreddit}/comments/${post.id}`;
}

const nextCursor = (rows: readonly { created_utc: number }[]) => {
  const last = rows[rows.length - 1];
  return last ? new Date((last.created_utc - 1) * 1000).toISOString() : undefined;
};

function rankPosts(posts: RawPost[], page: number): RankedPost[] {
  return posts
    .filter((p) => p.id && p.title)
    .sort((a, b) => b.score - a.score)
    .slice(0, TOP_POSTS_LIMIT)
    .map((p, i) => ({
      id: p.id,
      rank: String(page * TOP_POSTS_LIMIT + i + 1).padStart(2, "0"),
      score: p.score,
      title: p.title || "(untitled)",
      author: p.author || "[deleted]",
      comments: p.num_comments,
      created_utc: p.created_utc,
      flair: p.link_flair_text || "Post",
      url: postUrl(p),
    }));
}

export function useSubreddit(subreddit: string) {
  return useQuery({
    queryKey: ["subreddit", subreddit],
    queryFn: ({ signal }) => fetchSubreddit(subreddit, signal),
    enabled: !!subreddit,
    ...opts,
  });
}

export function useSubredditActivity(subreddit: string, metric: SubredditMetric, enabled = true) {
  return useQuery({
    queryKey: ["subreddit-activity", subreddit, metric],
    queryFn: async ({ signal }): Promise<SubredditActivitySeries> => {
      const rows = await fetchSubredditTimeSeries(subreddit, metric, "month", signal);
      const sorted = [...rows].sort((a, b) => a.date - b.date);
      return {
        months: sorted.map((p) => monthLabel(p.date)),
        values: sorted.map((p) => Math.round(Number(p.value) || 0)),
      };
    },
    enabled: !!subreddit && enabled,
    ...opts,
  });
}

export function useSubredditWikis(subreddit: string, enabled = true) {
  return useQuery({
    queryKey: ["subreddit-wikis", subreddit],
    queryFn: async ({ signal }) => {
      try {
        return await fetchSubredditWikis(subreddit, signal);
      } catch (err) {
        if (err instanceof RateLimitError) throw err;
        return [];
      }
    },
    enabled: !!subreddit && enabled,
    retry: 0,
    staleTime: opts.staleTime,
  });
}

function useSubredditPostSample(subreddit: string, window: PostWindow, enabled: boolean) {
  return useQuery({
    queryKey: ["subreddit-post-sample", subreddit, window],
    queryFn: ({ signal }) =>
      fetchSubredditPosts(
        subreddit,
        "desc",
        POST_SAMPLE_LIMIT,
        afterForWindow(window),
        undefined,
        signal,
      ),
    enabled: !!subreddit && enabled,
    ...opts,
  });
}

export function useSubredditTopPosts(subreddit: string, window: PostWindow, enabled = true) {
  return useInfiniteQuery<
    TopPostsPage,
    Error,
    InfiniteData<TopPostsPage, TopPostsPageParam>,
    [string, string, PostWindow],
    TopPostsPageParam
  >({
    queryKey: ["subreddit-top-posts", subreddit, window],
    queryFn: async ({ pageParam, signal }) => {
      const rows = await fetchSubredditPosts(
        subreddit,
        "desc",
        TOP_POSTS_LIMIT,
        afterForWindow(window),
        pageParam.cursor,
        signal,
      );
      return {
        posts: rankPosts(rows, pageParam.page),
        cursor: nextCursor(rows) ?? pageParam.cursor,
        hasMore: rows.length === TOP_POSTS_LIMIT,
      };
    },
    initialPageParam: { page: 0 },
    getNextPageParam: (lastPage, pages) =>
      lastPage.hasMore ? { cursor: lastPage.cursor, page: pages.length } : undefined,
    enabled: !!subreddit && enabled,
    ...opts,
  });
}

export function useSubredditContributors(subreddit: string, enabled = true) {
  const sample = useSubredditPostSample(subreddit, "Year", enabled);
  return {
    ...sample,
    data: sample.data
      ? (() => {
          const counts = new Map<string, number>();
          for (const post of sample.data) {
            const author = post.author?.trim();
            if (!author || author === "[deleted]") continue;
            counts.set(author, (counts.get(author) ?? 0) + 1);
          }
          return [...counts.entries()]
            .map(([author, count]) => ({
              name: `u/${author}`,
              count,
              href: `https://www.reddit.com/user/${author}`,
            }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 8);
        })()
      : undefined,
    error: sample.error,
  };
}
