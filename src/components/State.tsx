export function Spinner() {
  return (
    <span className="inline-block h-4 w-4 rounded-full border-2 border-subtle/40 border-t-subtle animate-spin-fast" />
  );
}

export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center gap-2.5 py-5 font-mono text-xs text-dim">
      <Spinner />
      {label}
    </div>
  );
}

export function ErrorNote({ error }: { error: unknown }) {
  const msg = error instanceof Error ? error.message : String(error);
  return (
    <div className="py-4 font-mono text-xs leading-normal text-[#ff7a6e]">
      {msg}
    </div>
  );
}

export function Empty({ label }: { label: string }) {
  return <div className="py-4 font-mono text-xs text-dim">{label}</div>;
}
