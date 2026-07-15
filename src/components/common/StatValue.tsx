import { useCountUp } from '../../hooks/useCountUp';

/**
 * Animated stat text. Takes an already-formatted value ('$575K', '12.3%',
 * '$123,456', '3', '—'), counts the numeric core up from 0 and re-applies
 * the exact original formatting (prefix, decimals, thousands commas,
 * suffix). Unparseable values render verbatim.
 */

// prefix ($, ₪…) | signed number w/ optional commas+decimals | suffix (K, %, M…)
const VALUE_RE = /^([^\d\-.]*)(-?[\d,]+(?:\.\d+)?)(.*)$/;

export function StatValue({ value }: { value: string }) {
  const m = VALUE_RE.exec(value ?? '');
  const numStr = m?.[2] ?? '';
  const target = m ? parseFloat(numStr.replace(/,/g, '')) : 0;
  const decimals = numStr.split('.')[1]?.length ?? 0;
  const grouped = numStr.includes(',');

  // Hook is called unconditionally (rules of hooks); unparseable → target 0, unused.
  const n = useCountUp(target);

  if (!m || !Number.isFinite(target)) return <>{value}</>;

  const formatted = grouped
    ? n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
    : n.toFixed(decimals);

  return <>{m[1]}{formatted}{m[3]}</>;
}
