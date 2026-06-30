import { useEffect, useRef, useState } from "react";
import { RATE_LIMIT_EVENT } from "../api/arctic";

const SHOW_MS = 5000;

export function RateLimitToast() {
  const [msg, setMsg] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    function onLimit(e: Event) {
      const detail = (e as CustomEvent<string>).detail;
      setMsg(detail || "You're being rate limited. Slow down a moment.");
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setMsg(null), SHOW_MS);
    }
    window.addEventListener(RATE_LIMIT_EVENT, onLimit);
    return () => {
      window.removeEventListener(RATE_LIMIT_EVENT, onLimit);
      clearTimeout(timer.current);
    };
  }, []);

  if (!msg) return null;

  return (
    <div
      role="alert"
      className="fixed bottom-6 left-1/2 z-[100] flex max-w-[460px] -translate-x-1/2 animate-toast-in items-center gap-3 rounded-xl border border-[rgb(255_122_64_/_0.35)] bg-[rgb(20_14_12_/_0.92)] px-4 py-[13px] shadow-[0_12px_40px_rgb(0_0_0_/_0.5)] backdrop-blur-[10px]"
    >
      <span
        className="flex h-[26px] w-[26px] flex-none items-center justify-center rounded-[7px] border border-[rgb(255_122_64_/_0.3)] bg-[rgb(255_122_64_/_0.14)] text-[#ff9d6e]"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.7">
          <circle cx="7" cy="7" r="5.3" />
          <line x1="7" y1="4" x2="7" y2="7.5" />
          <circle cx="7" cy="10" r="0.2" />
        </svg>
      </span>
      <div className="min-w-0">
        <div className="text-[13px] font-semibold text-[#ffb497]">Rate limited</div>
        <div className="mt-0.5 font-mono text-xs text-[#c8a99c]">{msg}</div>
      </div>
      <button
        onClick={() => setMsg(null)}
        aria-label="Dismiss"
        className="ml-auto flex-none cursor-pointer border-0 bg-transparent p-1 text-base leading-none text-muted-3"
      >
        ×
      </button>
    </div>
  );
}
