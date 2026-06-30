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

export interface AreaChart {
  linePath: string;
  areaPath: string;
  lastDot: { cx: string; cy: string };
}

// Line + filled area path for the activity chart (ported from the design).
export function areaChart(series: number[], W = 780, H = 210): AreaChart {
  const pt = 14;
  const pb = 30;
  const pl = 10;
  const pr = 10;
  const iw = W - pl - pr;
  const ih = H - pt - pb;
  const vals = series.length ? series : [0, 0];
  const mn = Math.min(...vals);
  const mx = Math.max(...vals);
  const pts = vals.map((v, i) => {
    const x = pl + (vals.length === 1 ? 0 : i * (iw / (vals.length - 1)));
    const y = pt + ih - (mx === mn ? ih / 2 : ((v - mn) / (mx - mn)) * ih);
    return [x, y] as const;
  });
  const baseline = pt + ih;
  const linePath = "M " + pts.map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" L ");
  const last = pts[pts.length - 1];
  const first = pts[0];
  const areaPath = `${linePath} L ${last[0].toFixed(1)} ${baseline} L ${first[0].toFixed(1)} ${baseline} Z`;
  return { linePath, areaPath, lastDot: { cx: last[0].toFixed(1), cy: last[1].toFixed(1) } };
}
