import type { UserRecord } from "../api/arctic";
import { num, span } from "../lib/format";

interface Props {
  user: UserRecord;
  communities: number | undefined;
}

export function Composition({ user, communities }: Props) {
  const m = user._meta;
  const total = m.num_posts + m.num_comments || 1;
  const postPct = (m.num_posts / total) * 100;
  const commentPct = 100 - postPct;

  const firstSeen = Math.min(m.earliest_post_at, m.earliest_comment_at);
  const lastActive = Math.max(m.last_post_at, m.last_comment_at);

  const stats = [
    { label: "Posts", value: num(m.num_posts) },
    { label: "Comments", value: num(m.num_comments) },
    { label: "Communities", value: communities == null ? "…" : num(communities) },
    { label: "Active span", value: span(firstSeen, lastActive) },
  ];

  return (
    <div className="ks-card min-w-60 flex-1">
      <span className="ks-label">Contribution split</span>
      <div className="ks-endpoint">/api/users/search</div>
      <svg className="mt-4 block h-[9px] w-full overflow-hidden rounded-[5px]" viewBox="0 0 100 9" preserveAspectRatio="none">
        <rect x="0" y="0" width={postPct} height="9" fill="var(--accent)" />
        <rect x={postPct} y="0" width={commentPct} height="9" fill="var(--color-comment)" />
      </svg>
      <div className="mt-3 flex gap-[18px]">
        <Legend colorClass="bg-accent" label="Posts" pct={postPct} />
        <Legend colorClass="bg-comment" label="Comments" pct={commentPct} />
      </div>
      <div className="mt-3 flex flex-col">
        {stats.map((s) => (
          <div
            key={s.label}
            className="flex items-center justify-between border-t border-border-soft py-[11px]"
          >
            <span className="text-[13px] text-muted">{s.label}</span>
            <span className="font-mono text-sm text-fg">{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Legend({ colorClass, label, pct }: { colorClass: string; label: string; pct: number }) {
  return (
    <div className="flex items-center gap-[7px] text-xs">
      <span className={`h-2 w-2 rounded-sm ${colorClass}`} />
      <span className="text-muted-2">{label}</span>
      <span className="font-mono text-muted-3">{Math.round(pct)}%</span>
    </div>
  );
}
