export interface BarRow {
  name: string;
  count: number;
  href?: string;
}

export function BarList({ rows }: { rows: BarRow[] }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <div className="mt-[18px] flex flex-col gap-[13px]">
      {rows.map((r) => {
        const content = (
          <>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[13px] font-medium text-soft">{r.name}</span>
              <span className="font-mono text-xs text-muted-3">{r.count.toLocaleString()}</span>
            </div>
            <progress className="ks-progress" value={r.count} max={max} />
          </>
        );

        return (
          r.href ? (
            <a
              key={r.name}
              href={r.href}
              target="_blank"
              rel="noopener noreferrer"
              className="block cursor-pointer text-inherit no-underline"
            >
              {content}
            </a>
          ) : (
            <div key={r.name}>{content}</div>
          )
        );
      })}
    </div>
  );
}
