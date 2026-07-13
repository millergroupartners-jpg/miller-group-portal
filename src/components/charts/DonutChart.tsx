import { useId } from 'react';
import { useAnimatedValue } from '../../hooks/useAnimatedValue';

export interface DonutSlice {
  label: string;
  value: number;
  color: string;
}

/** Gold hexes that should render with the champagne gradient. */
const GOLD_HEXES = new Set(['#C9A84C', '#c9a84c', 'var(--gold)']);

/**
 * Pure-SVG donut chart. Colors come in via props (callers pass CSS-variable
 * friendly hex values); center text uses theme variables so dark/light both work.
 * Gold slices automatically get a champagne gradient stroke.
 */
export function DonutChart({
  slices,
  size = 180,
  strokeWidth = 22,
  centerTitle,
  centerSubtitle,
}: {
  slices: DonutSlice[];
  size?: number;
  strokeWidth?: number;
  centerTitle?: string;
  centerSubtitle?: string;
}) {
  const gradId = useId().replace(/:/g, '');
  const total = slices.reduce((s, x) => s + x.value, 0);
  const r = (size - strokeWidth) / 2;
  const c = size / 2;
  const circumference = 2 * Math.PI * r;
  // Animate the whole ring sweeping in
  const sweep = useAnimatedValue(1);

  let offset = 0;
  const arcs = slices.map(s => {
    const frac = total > 0 ? s.value / total : 0;
    const arc = { ...s, frac, start: offset };
    offset += frac;
    return arc;
  });

  return (
    <div style={{ position: 'relative', width: size, height: size, margin: '0 auto' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
        <defs>
          <linearGradient id={`dcGold-${gradId}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#E8CD7F" />
            <stop offset="0.55" stopColor="#C9A84C" />
            <stop offset="1" stopColor="#A9873A" />
          </linearGradient>
        </defs>
        {/* track */}
        <circle cx={c} cy={c} r={r} fill="none" stroke="var(--progress-track)" strokeWidth={strokeWidth} />
        {arcs.map((a, i) => (
          <circle
            key={i}
            cx={c} cy={c} r={r}
            fill="none"
            stroke={GOLD_HEXES.has(a.color) ? `url(#dcGold-${gradId})` : a.color}
            strokeWidth={strokeWidth}
            strokeDasharray={`${Math.max(a.frac * circumference * sweep - 2, 0)} ${circumference}`}
            strokeDashoffset={-a.start * circumference * sweep}
            strokeLinecap="butt"
            style={{ transition: 'stroke-dasharray 1.1s cubic-bezier(0.22, 1, 0.36, 1), stroke-dashoffset 1.1s cubic-bezier(0.22, 1, 0.36, 1)' }}
          />
        ))}
      </svg>
      {(centerTitle || centerSubtitle) && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none',
        }}>
          {centerTitle && (
            <div className="num" style={{
              fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700,
              color: 'var(--text-primary)', letterSpacing: '0.01em',
            }}>
              {centerTitle}
            </div>
          )}
          {centerSubtitle && (
            <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>
              {centerSubtitle}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
