import { useAnimatedValue } from '../../hooks/useAnimatedValue';

interface ProgressBarProps {
  target: number;
  height?: number;
  animate?: boolean;
}

export function ProgressBar({ target, height = 6, animate = true }: ProgressBarProps) {
  const value = animate ? useAnimatedValue(target) : target;
  return (
    <div className="progress-track" style={{ height }}>
      <div className="progress-fill" style={{ width: `${value}%` }} />
    </div>
  );
}
