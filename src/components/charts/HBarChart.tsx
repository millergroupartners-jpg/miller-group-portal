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

function Row({ bar, max }: { bar: HBar; max: number }) {
  const pct = max > 0 ? (bar.value / max) * 100 : 0;
  const pct2 = max > 0 && bar.secondary ? (bar.secondary.value / max) * 100 : 0;
  const w = useAnimatedValue(pct);
  const w2 = useAnimatedValue(pct2);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', textAlign: 'right' }}>
        {bar.label}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexDirection: 'row-reverse' }}>
        <div style={{ flex: 1, height: 10, borderRadius: 100, background: 'var(--bg-chip)', overflow: 'hidden', direction: 'rtl' }}>
          <div style={{
            width: `${w}%`, height: '100%', borderRadius: 100,
            background: bar.color, transition: 'width 0.9s ease',
          }} />
        </div>
        <span style={{ fontSize: 10, fontWeight: 700, color: bar.color, direction: 'ltr', minWidth: 52, textAlign: 'left' }}>
          {bar.valueLabel ?? bar.value.toLocaleString('en-US')}
        </span>
      </div>
      {bar.secondary && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexDirection: 'row-reverse' }}>
          <div style={{ flex: 1, height: 10, borderRadius: 100, background: 'var(--bg-chip)', overflow: 'hidden', direction: 'rtl' }}>
            <div style={{
              width: `${w2}%`, height: '100%', borderRadius: 100,
              background: bar.secondary.color, transition: 'width 0.9s ease',
            }} />
          </div>
          <span style={{ fontSize: 10, fontWeight: 700, color: bar.secondary.color, direction: 'ltr', minWidth: 52, textAlign: 'left' }}>
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
      {bars.map((b, i) => <Row key={i} bar={b} max={max} />)}
    </div>
  );
}
