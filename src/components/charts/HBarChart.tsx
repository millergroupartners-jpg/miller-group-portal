import { useAnimatedValue } from '../../hooks/useAnimatedValue';

export interface HBar {
  label: string;
  value: number;
  color: string;
  /** Text shown at the end of the bar (defaults to the raw value). */
  valueLabel?: string;
  /** Optional second bar rendered under the first (e.g. ARV vs all-in). */
  secondary?: { value: number; color: string; valueLabel?: string };
}

/* Sheen overlay works on any base color (no hex-alpha math needed):
   hot end sits on the right — where RTL bars start growing. */
const SHEEN = 'linear-gradient(to left, rgba(255,255,255,0.22), rgba(255,255,255,0.04) 55%, transparent)';

function Row({ bar, max, index }: { bar: HBar; max: number; index: number }) {
  const pct = max > 0 ? (bar.value / max) * 100 : 0;
  const pct2 = max > 0 && bar.secondary ? (bar.secondary.value / max) * 100 : 0;
  const w = useAnimatedValue(pct);
  const w2 = useAnimatedValue(pct2);
  const delay = `${index * 60}ms`;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', textAlign: 'right' }}>
        {bar.label}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexDirection: 'row-reverse' }}>
        <div style={{ flex: 1, height: 12, borderRadius: 100, background: 'var(--progress-track)', overflow: 'hidden', direction: 'rtl' }}>
          <div style={{
            width: `${w}%`, height: '100%', borderRadius: 100,
            backgroundColor: bar.color, backgroundImage: SHEEN,
            transition: 'width 0.9s cubic-bezier(0.22, 1, 0.36, 1)', transitionDelay: delay,
          }} />
        </div>
        <span className="num" style={{ fontSize: 10, fontWeight: 700, color: bar.color, minWidth: 52, textAlign: 'left' }}>
          {bar.valueLabel ?? bar.value.toLocaleString('en-US')}
        </span>
      </div>
      {bar.secondary && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexDirection: 'row-reverse' }}>
          <div style={{ flex: 1, height: 12, borderRadius: 100, background: 'var(--progress-track)', overflow: 'hidden', direction: 'rtl' }}>
            <div style={{
              width: `${w2}%`, height: '100%', borderRadius: 100,
              backgroundColor: bar.secondary.color, backgroundImage: SHEEN,
              transition: 'width 0.9s cubic-bezier(0.22, 1, 0.36, 1)', transitionDelay: delay,
            }} />
          </div>
          <span className="num" style={{ fontSize: 10, fontWeight: 700, color: bar.secondary.color, minWidth: 52, textAlign: 'left' }}>
            {bar.secondary.valueLabel ?? bar.secondary.value.toLocaleString('en-US')}
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * RTL horizontal bar chart — bars grow right-to-left, numerals stay LTR.
 * All rows share one scale (the max of every value incl. secondaries).
 */
export function HBarChart({ bars }: { bars: HBar[] }) {
  const max = Math.max(...bars.map(b => Math.max(b.value, b.secondary?.value ?? 0)), 0);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {bars.map((b, i) => <Row key={i} bar={b} max={max} index={i} />)}
    </div>
  );
}
