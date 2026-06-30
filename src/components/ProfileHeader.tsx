import type { UserRecord } from "../api/arctic";
import { useState } from "react";
import { avatarUrl, initials, monthYear, num, shortDate, relTime } from "../lib/format";

interface Props {
  user: UserRecord;
  communities: number | undefined;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-[0.07em] text-subtle">
        {label}
      </div>
      <div className="mt-[3px] font-mono text-[15px]">{value}</div>
    </div>
  );
}

export function ProfileHeader({ user, communities }: Props) {
  const [imgOk, setImgOk] = useState(true);
  const m = user._meta;
  const firstSeen = Math.min(m.earliest_post_at, m.earliest_comment_at);
  const lastActive = Math.max(m.last_post_at, m.last_comment_at);
  const total = m.num_posts + m.num_comments;
  const profileUrl = `https://www.reddit.com/user/${user.author}`;

  return (
    <div className="flex flex-wrap items-center gap-[22px] rounded-2xl border-4 border-double border-border bg-[image:var(--card-bg)] px-6 py-5">
      <a
        href={profileUrl}
        target="_blank"
        rel="noopener noreferrer"
        title={`Open u/${user.author} on reddit`}
        className="relative block h-[62px] w-[62px] flex-none cursor-pointer"
      >
        <div className="absolute -inset-[3px] rounded-full bg-ring opacity-90" />
        <div
          className="absolute inset-0 flex items-center justify-center overflow-hidden rounded-full bg-[#0d0d10] font-mono text-xl font-semibold text-accent"
        >
          {imgOk ? (
            <img
              src={avatarUrl(user.author)}
              alt={`u/${user.author} avatar`}
              width={62}
              height={62}
              onError={() => setImgOk(false)}
              className="block h-full w-full object-cover"
            />
          ) : (
            initials(user.author)
          )}
        </div>
      </a>
      <div className="min-w-[200px]">
        <a
          href={profileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="cursor-pointer text-[22px] font-semibold tracking-normal text-inherit no-underline hover:text-accent"
        >
          u/{user.author}
        </a>
        <div className="mt-[5px] font-mono text-[13px] text-muted-3">
          active since {monthYear(firstSeen)} · {num(total)} contributions archived
        </div>
      </div>
      <div className="ml-auto flex flex-wrap gap-[26px]">
        <Stat label="First seen" value={shortDate(firstSeen)} />
        <Stat label="Last active" value={relTime(lastActive)} />
        <Stat label="Total karma" value={num(m.total_karma)} />
        <Stat label="Communities" value={communities == null ? "…" : num(communities)} />
      </div>
    </div>
  );
}
