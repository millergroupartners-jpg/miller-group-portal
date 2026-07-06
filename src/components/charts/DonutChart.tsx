import { useAnimatedValue } from '../../hooks/useAnimatedValue';

export interface DonutSlice {
  label: string;
  value: number;
  color: string;
}

/**
 * Pure-SVG donut chart. Colors come in via props (callers pass CSS-variable
 * friendly hex values); center text uses theme variables so dark/light both work.
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
        {/* track */}
        <circle cx={c} cy={c} r={r} fill="none" stroke="var(--bg-chip)" strokeWidth={strokeWidth} />
        {arcs.map((a, i) => (
          <circle
            key={i}
            cx={c} cy={c} r={r}
            fill="none"
            stroke={a.color}
            strokeWidth={strokeWidth}
            strokeDasharray={`${Math.max(a.frac * circumference * sweep - 2, 0)} ${circumference}`}
            strokeDashoffset={-a.start * circumference * sweep}
            strokeLinecap="butt"
            style={{ transition: 'stroke-dasharray 0.9s ease, stroke-dashoffset 0.9s ease' }}
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
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', direction: 'ltr' }}>
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
