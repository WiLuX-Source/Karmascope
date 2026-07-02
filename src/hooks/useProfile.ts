import { useInfiniteQuery, useQuery, type InfiniteData } from "@tanstack/react-query";
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
export type RecentFilter = "All" | "Posts" | "Comments";

export const RANGE_MONTHS: Record<Range, number> = { "6M": 6, "12M": 12, "24M": 24 };
export const RECENT_PAGE_SIZE = 5;
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
    queryFn: ({ signal }) => fetchUser(username, signal),
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
    queryFn: async ({ signal }): Promise<ActivitySeries> => {
      const after = monthStart(earliestSec!);
      const before = nextMonthStart(lastActiveSec!);

      const [posts, comments] = await Promise.all([
        fetchPostsAggregate(username, after, before, signal),
        fetchCommentsAggregate(username, after, before, signal),
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
    queryFn: ({ signal }) => fetchSubreddits(username, 1000, signal),
    enabled: !!username,
    ...opts,
  });
}

export function useInteractions(username: string, enabled: boolean) {
  return useQuery({
    queryKey: ["interactions", username],
    queryFn: ({ signal }) => fetchInteractions(username, 8, signal),
    enabled: !!username && enabled,
    retry: 0, // endpoint frequently 504s on heavy users; fail fast
    staleTime: opts.staleTime,
  });
}

export function useFlairs(username: string) {
  return useQuery({
    queryKey: ["flairs", username],
    queryFn: ({ signal }) => fetchFlairs(username, signal),
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

interface RecentPageParam {
  cursor?: string;
}

interface RecentPage {
  items: RecentItem[];
  cursor?: string;
  hasMore: boolean;
}

type RecentKind = "Posts" | "Comments";
type RecentQueryKey = ["recent-kind", string, Sort, RecentKind];

const searchCursor = (sort: Sort, cursor?: string) =>
  cursor ? { [sort === "Newest" ? "before" : "after"]: cursor } : {};

const nextCursor = (rows: readonly { created_utc: number }[], sort: Sort) => {
  const last = rows[rows.length - 1];
  if (!last) return undefined;
  const nextSecond = last.created_utc + (sort === "Newest" ? -1 : 1);
  return new Date(nextSecond * 1000).toISOString();
};

function sortRecent(items: RecentItem[], sort: Sort) {
  return [...items].sort((a, b) =>
    sort === "Newest" ? b.created_utc - a.created_utc : a.created_utc - b.created_utc,
  );
}

function uniqueRecent(items: RecentItem[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.kind}:${item.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function useRecentKind(username: string, sort: Sort, kind: RecentKind, enabled: boolean) {
  const dir = sort === "Newest" ? "desc" : "asc";
  return useInfiniteQuery<
    RecentPage,
    Error,
    InfiniteData<RecentPage, RecentPageParam>,
    RecentQueryKey,
    RecentPageParam
  >({
    queryKey: ["recent-kind", username, sort, kind],
    queryFn: async ({ pageParam, signal }) => {
      const cursor = searchCursor(sort, pageParam.cursor);
      const rows =
        kind === "Posts"
          ? await fetchRecentPosts(username, dir, RECENT_PAGE_SIZE, cursor, signal)
          : await fetchRecentComments(username, dir, RECENT_PAGE_SIZE, cursor, signal);
      const items: RecentItem[] = rows.map((row) => {
        if (kind === "Posts") {
          const post = row as Awaited<ReturnType<typeof fetchRecentPosts>>[number];
          return {
            id: post.id,
            kind: "Post" as const,
            score: post.score,
            text: post.title || post.selftext || "(untitled)",
            subreddit: post.subreddit,
            comments: post.num_comments,
            created_utc: post.created_utc,
            url: `https://www.reddit.com/r/${post.subreddit}/comments/${post.id}`,
          };
        }

        const comment = row as Awaited<ReturnType<typeof fetchRecentComments>>[number];
        const postId = (comment.link_id ?? "").replace(/^t3_/, "");
        return {
          id: comment.id,
          kind: "Comment" as const,
          score: comment.score,
          text: comment.body || "(empty)",
          subreddit: comment.subreddit,
          created_utc: comment.created_utc,
          url: postId
            ? `https://www.reddit.com/r/${comment.subreddit}/comments/${postId}/comment/${comment.id}`
            : `https://www.reddit.com/comments/${comment.id}`,
        };
      });
      return {
        items: sortRecent(items, sort),
        cursor: nextCursor(rows, sort) ?? pageParam.cursor,
        hasMore: rows.length === RECENT_PAGE_SIZE,
      };
    },
    initialPageParam: {},
    getNextPageParam: (lastPage) => (lastPage.hasMore ? { cursor: lastPage.cursor } : undefined),
    enabled: !!username && enabled,
    ...opts,
  });
}

export function useRecent(username: string, sort: Sort, filter: RecentFilter) {
  const includePosts = filter !== "Comments";
  const includeComments = filter !== "Posts";
  const posts = useRecentKind(username, sort, "Posts", includePosts);
  const comments = useRecentKind(username, sort, "Comments", includeComments);
  const postItems = includePosts ? (posts.data?.pages.flatMap((page) => page.items) ?? []) : [];
  const commentItems = includeComments
    ? (comments.data?.pages.flatMap((page) => page.items) ?? [])
    : [];
  const activeQueries = [
    ...(includePosts ? [posts] : []),
    ...(includeComments ? [comments] : []),
  ];

  return {
    data: sortRecent(uniqueRecent([...postItems, ...commentItems]), sort),
    isLoading: activeQueries.some((query) => query.isLoading),
    isFetching: activeQueries.some((query) => query.isFetching),
    isFetchingNextPage: activeQueries.some((query) => query.isFetchingNextPage),
    hasNextPage: activeQueries.some((query) => query.hasNextPage),
    fetchNextPage: async () => {
      await Promise.all(
        activeQueries
          .filter((query) => query.hasNextPage && !query.isFetchingNextPage)
          .map((query) => query.fetchNextPage()),
      );
    },
    error: activeQueries.find((query) => query.error)?.error,
  };
}
