import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Header } from "./components/Header";
import { Empty, ErrorNote, Loading } from "./components/State";
import { RowsSkeleton } from "./components/Skeleton";
import {
  fetchGhostdditUserView,
  ghostdditUserUrl,
  type GhostdditSort,
  type GhostdditUserType,
} from "./api/ghostddit";
import type { RedditKind } from "./lib/userRoute";

interface GhostdditAppProps {
  username: string;
  onHandleSubmit: (kind: RedditKind, value: string) => void;
  onBackToArchive: () => void;
}

const sorts: GhostdditSort[] = ["new", "hot", "old", "top", "comments"];

export function GhostdditApp({ username, onHandleSubmit, onBackToArchive }: GhostdditAppProps) {
  const qc = useQueryClient();
  const [type, setType] = useState<GhostdditUserType>("post");
  const [sort, setSort] = useState<GhostdditSort>("new");
  const query = useQuery({
    queryKey: ["ghostddit-user-view", username, type, sort],
    queryFn: () => fetchGhostdditUserView(username, { type, sort }),
    enabled: !!username,
    staleTime: 1000 * 60 * 5,
    retry: 1,
  });
  const sourceUrl = query.data?.sourceUrl ?? ghostdditUserUrl(username, { type, sort });

  function handleRescan() {
    qc.invalidateQueries({ queryKey: ["ghostddit-user-view", username] });
  }

  return (
    <div className="ks-page relative min-h-screen">
      <div className="ks-grid" />
      <Header
        kind="user"
        handle={username}
        onSubmit={onHandleSubmit}
        onRescan={handleRescan}
        syncing={query.isFetching}
        sourceLabel="ghostddit"
      />

      <main className="relative mx-auto flex max-w-[1340px] flex-col gap-3.5 px-4 pb-[60px] pt-[22px] sm:px-[26px]">
        <div className="flex flex-wrap items-center justify-between gap-3.5 rounded-xl border border-border bg-[image:var(--card-bg)] px-4 py-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-subtle">
              Ghostddit user view
            </div>
            <div className="mt-1 font-mono text-[13px] text-soft">u/{username}</div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onBackToArchive}
              className="ks-glass-control cursor-pointer rounded-lg px-3 py-2 text-xs font-semibold text-soft"
            >
              Arctic archive
            </button>
            <a
              href={sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="cursor-pointer rounded-lg border border-accent-soft bg-accent-soft px-3 py-2 text-xs font-semibold text-accent no-underline hover:border-accent"
            >
              Open Ghostddit
            </a>
          </div>
        </div>

        <GhostdditControls type={type} sort={sort} onTypeChange={setType} onSortChange={setSort} />

        <section className="ks-card">
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <span className="ks-label">{type === "comment" ? "Ghostddit comments" : "Ghostddit posts"}</span>
            <span className="font-mono text-xs text-dim">sort={sort}</span>
          </div>
          <div className="ks-endpoint">ghostddit.pages.dev/user/{username}</div>

          {query.isLoading ? (
            <RowsSkeleton rows={6} />
          ) : query.error ? (
            <ErrorNote error={query.error} />
          ) : query.data?.items.length ? (
            <div className="mt-2 flex flex-col">
              {query.data.items.map((item) => (
                <article key={item.id} className="border-t border-border-soft py-[15px]">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md bg-white/[0.05] px-2 py-[3px] text-[11px] font-medium text-muted">
                      {item.kind}
                    </span>
                    {item.links[0] && (
                      <a
                        href={item.links[0].url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-xs text-accent no-underline hover:underline"
                      >
                        {item.links[0].label}
                      </a>
                    )}
                  </div>
                  <div className="mt-2 flex gap-3.5">
                    {item.image && (
                      <img
                        src={item.image}
                        alt=""
                        className="h-[74px] w-[96px] flex-none rounded-lg border border-border-soft object-cover"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <h2 className="m-0 text-[15px] font-semibold leading-snug text-soft">{item.title}</h2>
                      <p className="mt-1.5 line-clamp-3 text-[13px] leading-normal text-muted-3">{item.text}</p>
                      {item.links.length > 1 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {item.links.slice(1).map((link) => (
                            <a
                              key={link.url}
                              href={link.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-mono text-[11px] text-subtle no-underline hover:text-accent"
                            >
                              {link.label}
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <Empty label="No Ghostddit activity returned" />
          )}
        </section>

        {query.isFetching && !query.isLoading ? <Loading label="refreshing ghostddit view..." /> : null}

        <div className="pt-1.5 text-center font-mono text-[11px] text-faint">
          karmascope · user data via ghostddit.pages.dev · not affiliated with reddit
        </div>
      </main>
    </div>
  );
}

function GhostdditControls({
  type,
  sort,
  onTypeChange,
  onSortChange,
}: {
  type: GhostdditUserType;
  sort: GhostdditSort;
  onTypeChange: (type: GhostdditUserType) => void;
  onSortChange: (sort: GhostdditSort) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-[22px] rounded-xl border border-border bg-[image:var(--card-bg)] px-4 py-3">
      <div className="flex items-center gap-[9px]">
        <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-dim">View</span>
        <div className="ks-glass-control flex gap-0.5 rounded-lg p-0.5">
          {(["post", "comment"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => onTypeChange(option)}
              className={`cursor-pointer rounded-md border-0 px-2.5 py-[5px] font-mono text-xs ${
                option === type ? "bg-accent font-semibold text-white" : "bg-transparent font-normal text-muted"
              }`}
            >
              {option === "post" ? "Posts" : "Comments"}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-[9px]">
        <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-dim">Sort</span>
        <div className="ks-glass-control flex flex-wrap gap-0.5 rounded-lg p-0.5">
          {sorts.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => onSortChange(option)}
              className={`cursor-pointer rounded-md border-0 px-2.5 py-[5px] font-mono text-xs capitalize ${
                option === sort ? "bg-accent font-semibold text-white" : "bg-transparent font-normal text-muted"
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
