const nf = new Intl.NumberFormat("en-US");

export const num = (n: number | null | undefined) =>
  n == null || Number.isNaN(n) ? "—" : nf.format(Math.round(n));

export const compact = (n: number) =>
  new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);

// unix seconds -> "Apr 02 '19"
export function shortDate(unixSec: number): string {
  if (!unixSec) return "—";
  const d = new Date(unixSec * 1000);
  const mon = d.toLocaleString("en-US", { month: "short" });
  const day = String(d.getDate()).padStart(2, "0");
  return `${mon} ${day} '${String(d.getFullYear()).slice(2)}`;
}

// "12m ago", "3w ago", "2mo ago", "1y ago"
export function relTime(unixSec: number): string {
  if (!unixSec) return "—";
  const diff = Date.now() / 1000 - unixSec;
  const units: [number, string][] = [
    [60, "s"],
    [3600, "m"],
    [86400, "h"],
    [604800, "d"],
    [2629800, "w"],
    [31557600, "mo"],
  ];
  if (diff >= 31557600) return `${Math.floor(diff / 31557600)}y ago`;
  for (let i = units.length - 1; i >= 0; i--) {
    const [sec, label] = units[i];
    if (diff >= sec) return `${Math.floor(diff / sec)}${label} ago`;
  }
  return "just now";
}

// "active since Apr 2019"
export function monthYear(unixSec: number): string {
  if (!unixSec) return "—";
  const d = new Date(unixSec * 1000);
  return `${d.toLocaleString("en-US", { month: "short" })} ${d.getFullYear()}`;
}

// human active span: "7y 1mo"
export function span(fromSec: number, toSec: number): string {
  if (!fromSec || !toSec) return "—";
  let months = Math.max(0, Math.round((toSec - fromSec) / 2629800));
  const y = Math.floor(months / 12);
  months -= y * 12;
  if (y && months) return `${y}y ${months}mo`;
  if (y) return `${y}y`;
  return `${months}mo`;
}

export const initials = (name: string) =>
  (name.replace(/[^a-z0-9]/gi, "").slice(0, 2) || "u").toUpperCase();

// Reddit ships 7 default avatars on its CDN. Pick one deterministically from
// the username so a given user always shows the same avatar.
const AVATAR_COUNT = 7;
export function avatarUrl(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  const idx = hash % AVATAR_COUNT;
  return `https://www.redditstatic.com/avatars/defaults/v2/avatar_default_${idx}.png`;
}
