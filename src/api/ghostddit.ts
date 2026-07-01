// Ghostddit-style live Reddit source.
//
// Ghostddit does not expose a documented subreddit JSON endpoint; its public
// copy says it reads live Reddit public API/search-index data. For subreddit
// freshness we use the same public subreddit-about JSON shape directly.

const BASE = "https://api.reddit.com";
const TIMEOUT_MS = 4500;

type Query = Record<string, string | number | boolean | undefined>;

export class GhostdditUnavailableError extends Error {
  source = "ghostddit";
}

export interface GhostdditSubreddit {
  display_name: string;
  display_name_prefixed?: string;
  title?: string;
  public_description?: string;
  description?: string;
  created_utc: number;
  subscribers?: number;
  active_user_count?: number;
  accounts_active?: number;
  over18: boolean;
  icon_img?: string;
  community_icon?: string;
  primary_color?: string;
  key_color?: string;
  url?: string;
  wiki_enabled?: boolean;
}

interface RedditThing<T> {
  kind?: string;
  data?: T;
  message?: string;
  error?: number | string;
}

function cleanSubreddit(subreddit: string) {
  return subreddit.trim().replace(/^r\//i, "");
}

function isRateLimit(status: number, msg: string): boolean {
  return status === 429 || /rate.?limit|slow down|too many/i.test(msg);
}

async function get<T>(path: string, params: Query = {}): Promise<T> {
  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
  }

  const controller = new AbortController();
  const timer = globalThis.setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url.toString(), {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
      },
    });
    const text = await res.text();
    let json: RedditThing<unknown> = {};
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      if (!res.ok) {
        throw new GhostdditUnavailableError(`Reddit live source unavailable: HTTP ${res.status} on ${path}`);
      }
      throw new GhostdditUnavailableError(`Reddit live source returned invalid JSON from ${path}`);
    }
    if (!res.ok || json?.error) {
      const msg = json?.message || json?.error || `HTTP ${res.status} on ${path}`;
      const prefix = isRateLimit(res.status, String(msg)) ? "rate limited" : "unavailable";
      throw new GhostdditUnavailableError(`Reddit live source ${prefix}: ${msg}`);
    }
    return json as T;
  } catch (err) {
    if (err instanceof GhostdditUnavailableError) throw err;
    const msg = err instanceof Error ? err.message : String(err);
    throw new GhostdditUnavailableError(`Reddit live source unavailable: ${msg}`);
  } finally {
    globalThis.clearTimeout(timer);
  }
}

export async function fetchGhostdditSubreddit(subreddit: string) {
  const name = encodeURIComponent(cleanSubreddit(subreddit));
  const thing = await get<RedditThing<GhostdditSubreddit>>(`/r/${name}/about`);
  if (!thing.data?.display_name) {
    throw new GhostdditUnavailableError(`No live subreddit data for r/${subreddit}`);
  }
  return thing.data;
}
