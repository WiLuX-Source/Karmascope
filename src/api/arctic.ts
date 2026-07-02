// Arctic Shift API client — https://arctic-shift.photon-reddit.com
// All endpoints are GET, JSON, CORS-open (access-control-allow-origin: *).

const BASE = "https://arctic-shift.photon-reddit.com";

type Query = Record<string, string | number | boolean | undefined>;
type SearchCursor = { after?: string; before?: string };
interface RequestOptions {
  signal?: AbortSignal;
}

export const RATE_LIMIT_EVENT = "arctic-rate-limit";

export class RateLimitError extends Error {
  rateLimited = true;
}

function isRateLimit(status: number, msg: string): boolean {
  return status === 429 || /rate.?limit|slow down|too many/i.test(msg);
}

const MAX_CONCURRENT_REQUESTS = 2;
const REQUEST_SPACING_MS = 250;
const DEFAULT_RATE_LIMIT_BACKOFF_MS = 4_000;

interface QueuedRequest {
  url: string;
  signal?: AbortSignal;
  resolve: (response: Response) => void;
  reject: (error: unknown) => void;
  cleanup: () => void;
}

const requestQueue: QueuedRequest[] = [];
let activeRequests = 0;
let lastRequestStartedAt = 0;
let pausedUntil = 0;

function abortError() {
  return new DOMException("Request aborted", "AbortError");
}

function removeQueuedRequest(task: QueuedRequest) {
  const index = requestQueue.indexOf(task);
  if (index !== -1) requestQueue.splice(index, 1);
}

function noteRateLimit(response?: Response) {
  const retryAfter = response?.headers.get("retry-after");
  const retrySeconds = retryAfter ? Number(retryAfter) : Number.NaN;
  const retryDate = retryAfter && Number.isNaN(retrySeconds) ? Date.parse(retryAfter) : Number.NaN;
  const waitMs = Number.isFinite(retrySeconds)
    ? retrySeconds * 1000
    : Number.isFinite(retryDate)
      ? Math.max(0, retryDate - Date.now())
      : DEFAULT_RATE_LIMIT_BACKOFF_MS;
  pausedUntil = Math.max(pausedUntil, Date.now() + waitMs);
}

function pumpQueue() {
  if (activeRequests >= MAX_CONCURRENT_REQUESTS) return;
  const task = requestQueue.shift();
  if (!task) return;
  if (task.signal?.aborted) {
    task.cleanup();
    task.reject(abortError());
    pumpQueue();
    return;
  }

  const now = Date.now();
  const waitMs = Math.max(
    pausedUntil - now,
    REQUEST_SPACING_MS - (now - lastRequestStartedAt),
    0,
  );
  if (waitMs > 0) {
    requestQueue.unshift(task);
    globalThis.setTimeout(pumpQueue, waitMs);
    return;
  }

  activeRequests++;
  lastRequestStartedAt = Date.now();
  task.cleanup();
  fetch(task.url, { signal: task.signal })
    .then((response) => {
      if (response.status === 429) noteRateLimit(response);
      task.resolve(response);
    })
    .catch(task.reject)
    .finally(() => {
      activeRequests--;
      pumpQueue();
    });

  pumpQueue();
}

function queuedFetch(url: string, signal?: AbortSignal): Promise<Response> {
  if (signal?.aborted) return Promise.reject(abortError());

  return new Promise((resolve, reject) => {
    const task: QueuedRequest = {
      url,
      signal,
      resolve,
      reject,
      cleanup: () => signal?.removeEventListener("abort", onAbort),
    };
    function onAbort() {
      removeQueuedRequest(task);
      reject(abortError());
    }
    signal?.addEventListener("abort", onAbort, { once: true });
    requestQueue.push(task);
    pumpQueue();
  });
}

async function get<T>(path: string, params: Query = {}, options: RequestOptions = {}): Promise<T> {
  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
  }
  const res = await queuedFetch(url.toString(), options.signal);
  const json = await res.json().catch(() => ({}));
  if (!res.ok || (json && json.error)) {
    const msg = json?.error || `HTTP ${res.status} on ${path}`;
    if (isRateLimit(res.status, msg)) {
      noteRateLimit(res);
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

export function fetchUser(author: string, signal?: AbortSignal) {
  return get<{ data: UserRecord[] }>("/api/users/search", {
    author,
    limit: 1,
  }, { signal }).then((r) => {
    const u = r.data?.[0];
    if (!u) throw new Error(`No archived data for u/${author}`);
    return u;
  });
}

// ---- /api/subreddits/search ----
export interface SubredditMeta {
  earliest_comment: number;
  earliest_post: number;
  num_comments: number;
  num_posts: number;
  num_comments_updated_at?: number;
  num_posts_updated_at?: number;
}
export interface SubredditRecord {
  display_name: string;
  display_name_prefixed?: string;
  title?: string;
  public_description?: string;
  description?: string;
  created_utc: number;
  subscribers?: number;
  over18: boolean;
  icon_img?: string;
  community_icon?: string;
  banner_img?: string;
  banner_background_image?: string;
  mobile_banner_image?: string;
  banner_background_color?: string;
  primary_color?: string;
  key_color?: string;
  url?: string;
  wiki_enabled?: boolean;
  _meta: SubredditMeta;
}

export function fetchSubreddit(subreddit: string, signal?: AbortSignal) {
  const pick = (rows: SubredditRecord[] | undefined) => {
    const lower = subreddit.toLowerCase();
    return (
      rows?.find((s) => s.display_name?.toLowerCase() === lower) ??
      rows?.find((s) => s.display_name_prefixed?.toLowerCase() === `r/${lower}`) ??
      rows?.[0]
    );
  };

  return get<{ data: SubredditRecord[] }>("/api/subreddits/search", {
    subreddit,
    limit: 10,
  }, { signal }).then(async (r) => {
    const exact =
      pick(r.data) ??
      pick(
        (
          await get<{ data: SubredditRecord[] }>("/api/subreddits/search", {
            subreddit,
            limit: 10,
            over18: true,
          }, { signal })
        ).data,
      );
    if (!exact) throw new Error(`No archived data for r/${subreddit}`);
    return exact;
  });
}

// ---- /api/time_series ----
export type SubredditSeriesMetric = "Subscribers" | "Posts" | "Comments" | "Score";
export interface TimeSeriesPoint {
  date: number;
  value: number;
}

const seriesKey: Record<SubredditSeriesMetric, string> = {
  Subscribers: "subscribers",
  Posts: "posts/count",
  Comments: "comments/count",
  Score: "posts/sum_score",
};

export function fetchSubredditTimeSeries(
  subreddit: string,
  metric: SubredditSeriesMetric,
  precision = "month",
  signal?: AbortSignal,
) {
  return get<{ data: TimeSeriesPoint[] }>("/api/time_series", {
    key: `r/${subreddit}/${seriesKey[metric]}`,
    precision,
  }, { signal }).then((r) => r.data ?? []);
}

// ---- /api/subreddits/wikis/list ----
export interface WikiPage {
  name: string;
  path: string;
}

export function fetchSubredditWikis(subreddit: string, signal?: AbortSignal) {
  return get<{ data: string[] }>("/api/subreddits/wikis/list", {
    subreddit,
  }, { signal }).then((r) =>
    (r.data ?? []).map((path) => {
      const name = path.split("/").filter(Boolean).pop() ?? "index";
      return { name, path };
    }),
  );
}

// ---- aggregates by month ----
export interface AggBucket {
  created_utc: string;
  count: string; // API returns count as a string
}

function aggregate(
  kind: "posts" | "comments",
  author: string,
  after: string,
  before: string,
  signal?: AbortSignal,
) {
  return get<{ data: AggBucket[] }>(`/api/${kind}/search/aggregate`, {
    author,
    aggregate: "created_utc",
    frequency: "month",
    after,
    before,
  }, { signal }).then((r) => r.data ?? []);
}

export const fetchPostsAggregate = (
  author: string,
  after: string,
  before: string,
  signal?: AbortSignal,
) => aggregate("posts", author, after, before, signal);
export const fetchCommentsAggregate = (
  author: string,
  after: string,
  before: string,
  signal?: AbortSignal,
) => aggregate("comments", author, after, before, signal);

// ---- /api/users/interactions/subreddits ----
export interface SubInteraction {
  subreddit: string;
  count: number;
}
export function fetchSubreddits(author: string, limit = 1000, signal?: AbortSignal) {
  return get<{ data: SubInteraction[] }>("/api/users/interactions/subreddits", {
    author,
    limit,
  }, { signal }).then((r) => r.data ?? []);
}

// ---- /api/users/interactions/users (can 504 on heavy users) ----
export interface UserInteraction {
  username: string;
  count: number;
}
export function fetchInteractions(author: string, limit = 8, signal?: AbortSignal) {
  return get<{ data: Array<Record<string, unknown>> }>("/api/users/interactions/users", {
    author,
    limit,
  }, { signal }).then((r) =>
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
export function fetchFlairs(author: string, signal?: AbortSignal) {
  return get<{ data: Record<string, Record<string, number>> }>("/api/users/aggregate_flairs", {
    author,
  }, { signal }).then((r) => {
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
  author?: string;
  score: number;
  subreddit: string;
  num_comments: number;
  created_utc: number;
  permalink?: string;
  link_flair_text?: string;
}
export interface RawComment {
  id: string;
  body: string;
  score: number;
  subreddit: string;
  created_utc: number;
  link_id?: string;
}

export function fetchRecentPosts(
  author: string,
  sort: "asc" | "desc",
  limit = 8,
  cursor: SearchCursor = {},
  signal?: AbortSignal,
) {
  return get<{ data: RawPost[] }>("/api/posts/search", {
    author,
    sort,
    limit,
    ...cursor,
    fields: "id,title,selftext,score,subreddit,num_comments,created_utc",
  }, { signal }).then((r) => r.data ?? []);
}

export function fetchSubredditPosts(
  subreddit: string,
  sort: "asc" | "desc",
  limit = 120,
  after?: string,
  before?: string,
  signal?: AbortSignal,
) {
  return get<{ data: RawPost[] }>("/api/posts/search", {
    subreddit,
    sort,
    limit,
    after,
    before,
    fields: "id,title,author,score,subreddit,num_comments,created_utc,link_flair_text",
  }, { signal }).then((r) => r.data ?? []);
}

export function fetchRecentComments(
  author: string,
  sort: "asc" | "desc",
  limit = 8,
  cursor: SearchCursor = {},
  signal?: AbortSignal,
) {
  return get<{ data: RawComment[] }>("/api/comments/search", {
    author,
    sort,
    limit,
    ...cursor,
    fields: "id,body,score,subreddit,created_utc,link_id",
  }, { signal }).then((r) => r.data ?? []);
}
