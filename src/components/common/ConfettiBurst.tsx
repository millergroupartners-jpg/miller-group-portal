import { useEffect } from 'react';

/**
 * One-shot gold confetti burst + optional toast, for portfolio milestones.
 * CSS-only particles (no library), deterministic index math like the
 * onboarding particles (project convention: no Math.random in render).
 * Skipped entirely under prefers-reduced-motion.
 */

const PIECES = Array.from({ length: 28 }, (_, i) => ({
  left: (i * 37 + 5) % 100,
  size: 6 + (i % 3) * 2,
  delay: (i % 7) * 90,
  round: i % 4 === 0,
  color: ['var(--gold)', 'var(--gold-bright)', 'var(--gold-deep)', 'var(--gold-text)'][i % 4],
}));

export function ConfettiBurst({ message, onDone }: { message?: string; onDone: () => void }) {
  const reduced = typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    const t = setTimeout(onDone, reduced ? 0 : 2600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (reduced) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1200, pointerEvents: 'none', overflow: 'hidden' }}>
      {PIECES.map((p, i) => (
        <span
          key={i}
          className="confetti-piece"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.round ? p.size : p.size * 1.6,
            borderRadius: p.round ? '50%' : 2,
            background: p.color,
            animationDelay: `${p.delay}ms`,
          }}
        />
      ))}
      {message && (
        <div style={{
          position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--bg-surface)', border: '1px solid var(--gold-border)',
          borderRadius: 'var(--radius-badge)', padding: '12px 22px',
          fontSize: 14, fontWeight: 700, color: 'var(--gold-text)',
          boxShadow: 'var(--shadow-3), var(--gold-glow)', whiteSpace: 'nowrap',
        }} className="fade-up">
          {message}
        </div>
      )}
    </div>
  );
}
