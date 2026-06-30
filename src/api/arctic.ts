// Arctic Shift API client — https://arctic-shift.photon-reddit.com
// All endpoints are GET, JSON, CORS-open (access-control-allow-origin: *).

const BASE = "https://arctic-shift.photon-reddit.com";

type Query = Record<string, string | number | boolean | undefined>;

export const RATE_LIMIT_EVENT = "arctic-rate-limit";

export class RateLimitError extends Error {
  rateLimited = true;
}

function isRateLimit(status: number, msg: string): boolean {
  return (
    status === 429 ||
    status === 422 ||
    /rate.?limit|slow down|too many|timeout/i.test(msg)
  );
}

async function get<T>(path: string, params: Query = {}): Promise<T> {
  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
  }
  const res = await fetch(url.toString());
  const json = await res.json().catch(() => ({}));
  if (!res.ok || (json && json.error)) {
    const msg = json?.error || `HTTP ${res.status} on ${path}`;
    if (isRateLimit(res.status, msg)) {
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent(RATE_LIMIT_EVENT, { detail: msg }));
      }
      throw new RateLimitError("Arctic Shift is rate limiting requests. Slow down a moment.");
    }
    throw new Error(msg);
  }
  return json as T;
}

// ---- /api/users/search ----
export interface UserMeta {
  earliest_comment_at: number;
  earliest_post_at: number;
  last_comment_at: number;
  last_post_at: number;
  num_comments: number;
  num_posts: number;
  post_karma: number;
  comment_karma: number;
  total_karma: number;
}
export interface UserRecord {
  author: string;
  id: string;
  _meta: UserMeta;
}

export function fetchUser(author: string) {
  return get<{ data: UserRecord[] }>("/api/users/search", {
    author,
    limit: 1,
  }).then((r) => {
    const u = r.data?.[0];
    if (!u) throw new Error(`No archived data for u/${author}`);
    return u;
  });
}

// ---- aggregates by month ----
export interface AggBucket {
  created_utc: string;
  count: string; // API returns count as a string
}

function aggregate(kind: "posts" | "comments", author: string, after: string, before: string) {
  return get<{ data: AggBucket[] }>(`/api/${kind}/search/aggregate`, {
    author,
    aggregate: "created_utc",
    frequency: "month",
    after,
    before,
  }).then((r) => r.data ?? []);
}

export const fetchPostsAggregate = (author: string, after: string, before: string) =>
  aggregate("posts", author, after, before);
export const fetchCommentsAggregate = (author: string, after: string, before: string) =>
  aggregate("comments", author, after, before);

// ---- /api/users/interactions/subreddits ----
export interface SubInteraction {
  subreddit: string;
  count: number;
}
export function fetchSubreddits(author: string, limit = 1000) {
  return get<{ data: SubInteraction[] }>("/api/users/interactions/subreddits", {
    author,
    limit,
  }).then((r) => r.data ?? []);
}

// ---- /api/users/interactions/users (can 504 on heavy users) ----
export interface UserInteraction {
  username: string;
  count: number;
}
export function fetchInteractions(author: string, limit = 8) {
  return get<{ data: Array<Record<string, unknown>> }>("/api/users/interactions/users", {
    author,
    limit,
  }).then((r) =>
    (r.data ?? []).map((row) => {
      const name = (row.username ?? row.author ?? row.user ?? "") as string;
      return { username: name, count: Number(row.count ?? 0) };
    }),
  );
}

// ---- /api/users/aggregate_flairs ----
// shape: { "r/sub": { "flair text": count, ... }, ... }
export interface Flair {
  sub: string;
  flair: string;
  count: number;
}
export function fetchFlairs(author: string) {
  return get<{ data: Record<string, Record<string, number>> }>("/api/users/aggregate_flairs", {
    author,
  }).then((r) => {
    const out: Flair[] = [];
    for (const [sub, flairs] of Object.entries(r.data ?? {})) {
      let best = "";
      let bestN = -1;
      for (const [flair, n] of Object.entries(flairs)) {
        if (n > bestN) {
          bestN = n;
          best = flair.trim();
        }
      }
      if (best) out.push({ sub, flair: best, count: bestN });
    }
    return out.sort((a, b) => b.count - a.count);
  });
}

// ---- recent activity: /api/posts/search + /api/comments/search ----
export interface RawPost {
  id: string;
  title: string;
  selftext?: string;
  score: number;
  subreddit: string;
  num_comments: number;
  created_utc: number;
  permalink?: string;
}
export interface RawComment {
  id: string;
  body: string;
  score: number;
  subreddit: string;
  created_utc: number;
  link_id?: string;
}

export function fetchRecentPosts(author: string, sort: "asc" | "desc", limit = 8) {
  return get<{ data: RawPost[] }>("/api/posts/search", {
    author,
    sort,
    limit,
    fields: "id,title,selftext,score,subreddit,num_comments,created_utc",
  }).then((r) => r.data ?? []);
}

export function fetchRecentComments(author: string, sort: "asc" | "desc", limit = 8) {
  return get<{ data: RawComment[] }>("/api/comments/search", {
    author,
    sort,
    limit,
    fields: "id,body,score,subreddit,created_utc,link_id",
  }).then((r) => r.data ?? []);
}
