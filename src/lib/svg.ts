// Sparkline polyline points (ported from the design's spark()).
export function spark(vals: number[], w = 120, h = 32, pad = 3): string {
  if (!vals.length) return "";
  const mn = Math.min(...vals);
  const mx = Math.max(...vals);
  const n = vals.length;
  const iw = w - pad * 2;
  const ih = h - pad * 2;
  return vals
    .map((v, i) => {
      const x = pad + (n === 1 ? 0 : i * (iw / (n - 1)));
      const y = pad + ih - (mx === mn ? ih / 2 : ((v - mn) / (mx - mn)) * ih);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}
