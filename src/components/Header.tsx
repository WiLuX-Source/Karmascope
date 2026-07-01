import { useEffect, useState } from "react";
import { parseRedditHandle, type RedditKind } from "../lib/userRoute";

interface Props {
  kind: RedditKind;
  handle: string;
  onSubmit: (kind: RedditKind, value: string) => void;
  onRescan: () => void;
  syncing: boolean;
}

const prefixFor = (kind: RedditKind) => (kind === "subreddit" ? "r/" : "u/");
const kindFor = (prefix: string): RedditKind => (prefix === "r/" ? "subreddit" : "user");

export function Header({ kind, handle, onSubmit, onRescan, syncing }: Props) {
  const [draft, setDraft] = useState(handle);
  const [prefix, setPrefix] = useState(prefixFor(kind));

  useEffect(() => {
    setDraft(handle);
    setPrefix(prefixFor(kind));
  }, [handle, kind]);

  const parsed = parseRedditHandle(`${prefix}${draft}`, kindFor(prefix));
  const searchValid = !!parsed;

  function handleDraft(next: string) {
    const match = /^\s*(u|r)\//i.exec(next);
    if (match) {
      setPrefix(match[1].toLowerCase() === "r" ? "r/" : "u/");
      setDraft(next.replace(/^\s*[ur]\//i, ""));
    } else {
      setDraft(next);
    }
  }

  function handleSubmit() {
    const next = parseRedditHandle(`${prefix}${draft}`, kindFor(prefix));
    if (next) onSubmit(next.kind, next.value);
  }

  return (
    <header
      className="sticky top-0 z-10 flex flex-wrap items-center gap-3 border-b border-border-soft bg-[rgb(8_8_10_/_0.72)] px-4 py-3.5 backdrop-blur-[14px] sm:gap-[18px] sm:px-[26px]"
    >
      <div className="flex items-center gap-[11px]">
        <div
          className="flex h-[30px] w-[30px] items-center justify-center rounded-lg bg-accent [box-shadow:0_0_0_1px_rgb(255_255_255_/_0.08),0_6px_16px_color-mix(in_srgb,var(--accent)_28%,transparent)]"
        >
          <svg width="14" height="14" viewBox="0 0 14 14">
            <polygon points="7,2 12,9 2,9" fill="#fff" />
            <rect x="5.4" y="9" width="3.2" height="3" fill="#fff" />
          </svg>
        </div>
        <span className="text-[15px] font-semibold tracking-normal">Karmascope</span>
        <span
          className="ml-0.5 rounded-md border border-white/10 px-[7px] py-0.5 text-[11px] font-medium text-subtle"
        >
          arctic-shift
        </span>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit();
        }}
        className="ks-glass-control order-3 flex w-full items-center gap-[9px] rounded-[10px] px-3 py-2 sm:order-none sm:max-w-[440px] sm:flex-1"
      >
        <span className="text-dim">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6">
            <circle cx="6" cy="6" r="4.2" />
            <line x1="9.4" y1="9.4" x2="12.5" y2="12.5" />
          </svg>
        </span>
        <button
          type="button"
          onClick={() => setPrefix((p) => (p === "r/" ? "u/" : "r/"))}
          title="Toggle user or subreddit search"
          className={`cursor-pointer rounded-md border px-2 py-0.5 font-mono text-[13px] font-semibold transition ${
            searchValid
              ? "border-accent-soft bg-accent-soft text-accent [text-shadow:0_0_12px_var(--accent)]"
              : "border-white/10 bg-white/[0.04] text-dim"
          }`}
        >
          {prefix}
        </button>
        <input
          value={draft}
          onChange={(e) => handleDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleSubmit();
            }
          }}
          placeholder="subreddit or username"
          spellCheck={false}
          autoCapitalize="none"
          className="flex-1 border-0 bg-transparent font-mono text-[13px] text-fg"
        />
        <button
          type="submit"
          className="cursor-pointer rounded-[5px] border border-white/10 bg-transparent px-[5px] py-px text-[11px] text-dim"
        >
          ↵
        </button>
      </form>

      <div className="hidden flex-1 sm:block" />

      <div className="ml-auto flex items-center gap-[7px] text-xs text-muted-3 sm:ml-0">
        <span
          className={`h-[7px] w-[7px] rounded-full animate-ratpulse ${syncing ? "bg-[#ffb13d]" : "bg-[#3ddc97]"}`}
        />
        <span>{syncing ? "Syncing" : "Synced"}</span>
      </div>
      <button
        onClick={onRescan}
        className="flex cursor-pointer items-center gap-[7px] rounded-[9px] border-0 bg-accent px-3.5 py-2 text-[13px] font-semibold text-white [box-shadow:0_6px_16px_color-mix(in_srgb,var(--accent)_20%,transparent)]"
        title="Rescan"
      >
        <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.7">
          <path d="M12 7a5 5 0 1 1-1.5-3.6" />
          <polyline points="12,1.5 12,4 9.5,4" />
        </svg>
        <span className="hidden sm:inline">Rescan</span>
      </button>
    </header>
  );
}
