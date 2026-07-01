import { useQuery } from "@tanstack/react-query";
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

export function useSubreddit(subreddit: string) {
  return useQuery({
    queryKey: ["subreddit", subreddit],
    queryFn: () => fetchSubreddit(subreddit),
    enabled: !!subreddit,
    ...opts,
  });
}

export function useSubredditActivity(subreddit: string, metric: SubredditMetric) {
  return useQuery({
    queryKey: ["subreddit-activity", subreddit, metric],
    queryFn: async (): Promise<SubredditActivitySeries> => {
      const rows = await fetchSubredditTimeSeries(subreddit, metric);
      const sorted = [...rows].sort((a, b) => a.date - b.date);
      return {
        months: sorted.map((p) => monthLabel(p.date)),
        values: sorted.map((p) => Math.round(Number(p.value) || 0)),
      };
    },
    enabled: !!subreddit,
    ...opts,
  });
}

export function useSubredditWikis(subreddit: string) {
  return useQuery({
    queryKey: ["subreddit-wikis", subreddit],
    queryFn: async () => {
      try {
        return await fetchSubredditWikis(subreddit);
      } catch (err) {
        if (err instanceof RateLimitError) throw err;
        return [];
      }
    },
    enabled: !!subreddit,
    retry: 0,
    staleTime: opts.staleTime,
  });
}

export function useSubredditTopPosts(subreddit: string, window: PostWindow) {
  return useQuery({
    queryKey: ["subreddit-top-posts", subreddit, window],
    queryFn: async (): Promise<RankedPost[]> => {
      const posts = await fetchSubredditPosts(subreddit, "desc", 100, afterForWindow(window));
      return posts
        .filter((p) => p.id && p.title)
        .sort((a, b) => b.score - a.score)
        .slice(0, 8)
        .map((p, i) => ({
          id: p.id,
          rank: String(i + 1).padStart(2, "0"),
          score: p.score,
          title: p.title || "(untitled)",
          author: p.author || "[deleted]",
          comments: p.num_comments,
          created_utc: p.created_utc,
          flair: p.link_flair_text || "Post",
          url: postUrl(p),
        }));
    },
    enabled: !!subreddit,
    ...opts,
  });
}

export function useSubredditContributors(subreddit: string) {
  return useQuery({
    queryKey: ["subreddit-contributors", subreddit],
    queryFn: async () => {
      const posts = await fetchSubredditPosts(subreddit, "desc", 100, afterForWindow("Year"));
      const counts = new Map<string, number>();
      for (const post of posts) {
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
    },
    enabled: !!subreddit,
    retry: 0,
    staleTime: opts.staleTime,
  });
}
