import type { UserRecord } from "../api/arctic";
import { num } from "../lib/format";

interface Tile {
  label: string;
  field: string;
  value: string;
  sub: string;
}

interface Props {
  user: UserRecord;
  communities: number | undefined;
}

export function KpiTiles({ user, communities }: Props) {
  const m = user._meta;

  const tiles: Tile[] = [
    { label: "Total karma", field: "total_karma", value: num(m.total_karma), sub: "post + comment karma" },
    { label: "Posts", field: "num_posts", value: num(m.num_posts), sub: "archived submissions" },
    { label: "Comments", field: "num_comments", value: num(m.num_comments), sub: "archived comments" },
    {
      label: "Communities",
      field: "interactions",
      value: communities == null ? "…" : num(communities),
      sub: "subreddits interacted in",
    },
  ];

  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3.5">
      {tiles.map((t) => (
        <div
          key={t.label}
          className="rounded-[14px] border border-border bg-[image:var(--card-bg)] px-[18px] py-4"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-subtle">
              {t.label}
            </span>
            <span className="font-mono text-[10px] text-faint">{t.field}</span>
          </div>
          <div className="mt-3.5 font-mono text-[27px] font-semibold leading-none tracking-normal">
            {t.value}
          </div>
          <div className="mt-2.5 truncate whitespace-nowrap text-[11px] text-dim">
            {t.sub}
          </div>
        </div>
      ))}
    </div>
  );
}
