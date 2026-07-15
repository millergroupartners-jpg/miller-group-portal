/** Compact USD: $1.25M / $340K / $950. Returns '—' for 0/empty. */
export function fmtUSD(n: number): string {
  if (!n) return '—';
  if (n >= 1_000_000) return '$' + (n / 1_000_000).toFixed(2) + 'M';
  if (n >= 1_000)     return '$' + Math.round(n / 1000) + 'K';
  return '$' + n.toLocaleString('en-US');
}

/** Same as fmtUSD but renders 0/empty as '$0' (dashboard KPI variant). */
export function fmtUSDZero(n: number): string {
  return n ? fmtUSD(n) : '$0';
}
