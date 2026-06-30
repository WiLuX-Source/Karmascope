import { useQuery } from "@tanstack/react-query";
import { RateLimitError } from "../api/arctic";
import {
  fetchUser,
  fetchPostsAggregate,
  fetchCommentsAggregate,
  fetchSubreddits,
  fetchInteractions,
  fetchFlairs,
  fetchRecentPosts,
  fetchRecentComments,
} from "../api/arctic";

export type Range = "6M" | "12M" | "24M";
export type Metric = "Both" | "Posts" | "Comments";
export type Sort = "Newest" | "Oldest";

export const RANGE_MONTHS: Record<Range, number> = { "6M": 6, "12M": 12, "24M": 24 };
const isoDate = (d: Date) => d.toISOString().slice(0, 10);

// Arctic's monthly aggregate silently returns all-zero buckets unless the
// date bounds land on month boundaries, so snap them. `monthStart` for `after`,
// `nextMonthStart` for an inclusive `before`.
const monthStart = (sec: number) => {
  const d = new Date(sec * 1000);
  return isoDate(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)));
};
const nextMonthStart = (sec: number) => {
  const d = new Date(sec * 1000);
  return isoDate(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)));
};

export interface ActivitySeries {
  months: string[];
  postCounts: number[];
  commentCounts: number[];
}

const opts = {
  staleTime: Infinity,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
  retry: (count: number, err: unknown) => !(err instanceof RateLimitError) && count < 1,
} as const;

export function useUser(username: string) {
  return useQuery({
    queryKey: ["user", username],
    queryFn: () => fetchUser(username),
    enabled: !!username,
    ...opts,
  });
}

// Fetch the user's FULL lifetime monthly series, then trim the trailing
// all-zero tail. Arctic's per-author aggregate index lags behind live search,
// so the months between the last aggregated activity and _meta.last_active are
// empty — anchoring there would render an empty chart. Trimming the tail lands
// the window on the last month that actually has data. The component slices the
// selected range out of this lifetime series, so changing range never refetches.
export function useActivity(
  username: string,
  earliestSec: number | undefined,
  lastActiveSec: number | undefined,
) {
  return useQuery({
    queryKey: ["activity", username],
    queryFn: async (): Promise<ActivitySeries> => {
      const after = monthStart(earliestSec!);
      const before = nextMonthStart(lastActiveSec!);

      const [posts, comments] = await Promise.all([
        fetchPostsAggregate(username, after, before),
        fetchCommentsAggregate(username, after, before),
      ]);

      // Both share frequency=month + same bounds, so buckets align by index.
      const len = Math.max(posts.length, comments.length);
      const months: string[] = [];
      const postCounts: number[] = [];
      const commentCounts: number[] = [];
      for (let i = 0; i < len; i++) {
        const iso = posts[i]?.created_utc ?? comments[i]?.created_utc;
        const d = iso ? new Date(iso) : new Date();
        const label =
          d.getMonth() === 0
            ? `${d.toLocaleString("en-US", { month: "short" })} '${String(d.getFullYear()).slice(2)}`
            : d.toLocaleString("en-US", { month: "short" });
        months.push(label);
        postCounts.push(Number(posts[i]?.count ?? 0));
        commentCounts.push(Number(comments[i]?.count ?? 0));
      }

      // Drop the lagging empty tail (months where both series are 0).
      let end = months.length;
      while (end > 1 && postCounts[end - 1] === 0 && commentCounts[end - 1] === 0) end--;

      return {
        months: months.slice(0, end),
        postCounts: postCounts.slice(0, end),
        commentCounts: commentCounts.slice(0, end),
      };
    },
    enabled: !!username && !!earliestSec && !!lastActiveSec,
    ...opts,
  });
}

export function useSubreddits(username: string) {
  return useQuery({
    queryKey: ["subreddits", username],
    queryFn: () => fetchSubreddits(username),
    enabled: !!username,
    ...opts,
  });
}

export function useInteractions(username: string, enabled: boolean) {
  return useQuery({
    queryKey: ["interactions", username],
    queryFn: () => fetchInteractions(username),
    enabled: !!username && enabled,
    retry: 0, // endpoint frequently 504s on heavy users; fail fast
    staleTime: opts.staleTime,
  });
}

export function useFlairs(username: string) {
  return useQuery({
    queryKey: ["flairs", username],
    queryFn: () => fetchFlairs(username),
    enabled: !!username,
    ...opts,
  });
}

export interface RecentItem {
  id: string;
  kind: "Post" | "Comment";
  score: number;
  text: string;
  subreddit: string;
  comments?: number;
  created_utc: number;
  url: string;
}

export function useRecent(username: string, sort: Sort) {
  const dir = sort === "Newest" ? "desc" : "asc";
  return useQuery({
    queryKey: ["recent", username, sort],
    queryFn: async () => {
      const limit = 24;
      const [posts, comments] = await Promise.all([
        fetchRecentPosts(username, dir, limit),
        fetchRecentComments(username, dir, limit),
      ]);
      const items: RecentItem[] = [
        ...posts.map((p) => ({
          id: p.id,
          kind: "Post" as const,
          score: p.score,
          text: p.title || p.selftext || "(untitled)",
          subreddit: p.subreddit,
          comments: p.num_comments,
          created_utc: p.created_utc,
          url: `https://www.reddit.com/r/${p.subreddit}/comments/${p.id}`,
        })),
        ...comments.map((c) => {
          const postId = (c.link_id ?? "").replace(/^t3_/, "");
          return {
            id: c.id,
            kind: "Comment" as const,
            score: c.score,
            text: c.body || "(empty)",
            subreddit: c.subreddit,
            created_utc: c.created_utc,
            url: postId
              ? `https://www.reddit.com/r/${c.subreddit}/comments/${postId}/comment/${c.id}`
              : `https://www.reddit.com/comments/${c.id}`,
          };
        }),
      ];
      items.sort((a, b) =>
        sort === "Newest" ? b.created_utc - a.created_utc : a.created_utc - b.created_utc,
      );
      return items;
    },
    enabled: !!username,
    ...opts,
  });
}
