// Ghostddit user routes — https://ghostddit.pages.dev
//
// Ghostddit documents user views at /user/USERNAME, with query params such as
// ?type=comment and ?sort=top. No documented JSON endpoint was found, so the
// app reads Ghostddit's rendered user view through a CORS-readable text view.

const BASE = "https://ghostddit.pages.dev";
const READER_BASE = "https://r.jina.ai/http://r.jina.ai/http://";
const TIMEOUT_MS = 7000;

export type GhostdditUserType = "post" | "comment";
export type GhostdditSort = "new" | "hot" | "old" | "top" | "comments";

export interface GhostdditUserItem {
  id: string;
  kind: string;
  title: string;
  text: string;
  image?: string;
  links: Array<{ label: string; url: string }>;
}

export interface GhostdditUserView {
  username: string;
  sourceUrl: string;
  fetchedAt: number;
  title: string;
  items: GhostdditUserItem[];
  rawText: string;
}

function cleanUsername(username: string) {
  return username.trim().replace(/^u\//i, "");
}

export function ghostdditUserUrl(
  username: string,
  options: { type?: GhostdditUserType; sort?: GhostdditSort } = {},
) {
  const url = new URL(`/user/${encodeURIComponent(cleanUsername(username))}`, BASE);
  if (options.type === "comment") url.searchParams.set("type", "comment");
  if (options.sort && options.sort !== "new") url.searchParams.set("sort", options.sort);
  return url.toString();
}

function ghostdditReaderUrl(sourceUrl: string) {
  return READER_BASE + sourceUrl;
}

function stripMarkdown(value: string) {
  return value
    .replace(/!\[[^\]]*]\([^)]+\)/g, "")
    .replace(/\[([^\]]+)]\([^)]+\)/g, "$1")
    .replace(/[*_`~\\]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractImage(block: string) {
  return /!\[[^\]]*]\((https?:\/\/[^)]+)\)/.exec(block)?.[1];
}

function extractLinks(block: string) {
  const links: Array<{ label: string; url: string }> = [];
  const matches = block.matchAll(/\[([^\]]+)]\((https?:\/\/[^)]+)\)/g);
  for (const match of matches) {
    if (match.index != null && block[match.index - 1] === "!") continue;
    const label = stripMarkdown(match[1]);
    const url = match[2];
    if (label && url && !links.some((link) => link.url === url)) links.push({ label, url });
    if (links.length >= 4) break;
  }
  return links;
}

function meaningfulLines(block: string) {
  return block
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith("!["))
    .map(stripMarkdown)
    .filter((line) => line.length > 0);
}

function parseGhostdditMarkdown(username: string, sourceUrl: string, rawText: string): GhostdditUserView {
  const title = /^Title:\s*(.+)$/m.exec(rawText)?.[1]?.trim() || `u/${username} on Ghostddit`;
  const content = rawText
    .split("Markdown Content:")[1]
    ?.split("## About Ghostddit")[0]
    ?.trim() ?? rawText;
  const blockPattern = new RegExp(`(?=^u/${username.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b)`, "gim");
  const blocks = content
    .split(blockPattern)
    .map((block) => block.trim())
    .filter((block) => /^u\//i.test(block));

  const items = blocks
    .map((block, index): GhostdditUserItem | null => {
      const lines = meaningfulLines(block);
      if (!lines.length) return null;
      const heading = lines[0].replace(new RegExp(`^u/${username}\\s*`, "i"), "").trim();
      const body = lines.slice(1).find((line) => line.length > 35) ?? lines.slice(1).join(" ");
      if (!body) return null;
      return {
        id: `${username}-${index}`,
        kind: heading || "Activity",
        title: body.length > 110 ? `${body.slice(0, 110).trim()}...` : body,
        text: body,
        image: extractImage(block),
        links: extractLinks(block),
      };
    })
    .filter((item): item is GhostdditUserItem => !!item)
    .slice(0, 12);

  return {
    username,
    sourceUrl,
    fetchedAt: Date.now(),
    title,
    items,
    rawText: content,
  };
}

export async function fetchGhostdditUserView(
  username: string,
  options: { type?: GhostdditUserType; sort?: GhostdditSort } = {},
) {
  const clean = cleanUsername(username);
  const sourceUrl = ghostdditUserUrl(clean, options);
  const controller = new AbortController();
  const timer = globalThis.setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(ghostdditReaderUrl(sourceUrl), { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return parseGhostdditMarkdown(clean, sourceUrl, await res.text());
  } finally {
    globalThis.clearTimeout(timer);
  }
}
