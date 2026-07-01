export type RedditKind = "user" | "subreddit";

export interface RedditHandle {
  kind: RedditKind;
  value: string;
}

function cleanHandle(value: string) {
  return value.trim().replace(/^\/+/, "").replace(/\s+/g, "");
}

export function normalizeUsername(value: string) {
  return cleanHandle(value).replace(/^u\//i, "");
}

export function normalizeSubreddit(value: string) {
  return cleanHandle(value).replace(/^r\//i, "");
}

export function parseRedditHandle(value: string, fallbackKind: RedditKind): RedditHandle | null {
  const cleaned = cleanHandle(value);
  const match = /^(u|r)\/(.+)$/i.exec(cleaned);
  const kind = match ? (match[1].toLowerCase() === "r" ? "subreddit" : "user") : fallbackKind;
  const raw = match ? match[2] : cleaned;
  const normalized = kind === "subreddit" ? normalizeSubreddit(raw) : normalizeUsername(raw);

  if (!normalized || !/^[A-Za-z0-9._-]+$/.test(normalized)) return null;
  return { kind, value: normalized };
}
