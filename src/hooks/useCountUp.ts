import { useEffect, useState } from 'react';

const prefersReduced = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * rAF count-up from 0 to `target` with a cubic ease-out. Restarts only when
 * `target` changes; instant under prefers-reduced-motion or duration 0.
 * (Distinct from useAnimatedValue, which is a CSS-transition trigger.)
 */
export function useCountUp(target: number, duration = 900): number {
  const [value, setValue] = useState(() => (prefersReduced() ? target : 0));

  useEffect(() => {
    if (prefersReduced() || duration <= 0 || !Number.isFinite(target)) {
      setValue(target);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(target * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    // rAF doesn't fire in hidden/background tabs — guarantee the final value regardless.
    const settle = setTimeout(() => setValue(target), duration + 150);
    return () => { cancelAnimationFrame(raf); clearTimeout(settle); };
  }, [target, duration]);

  return value;
}
