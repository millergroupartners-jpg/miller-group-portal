import type { BadgeType } from '../../types';

interface StatusBadgeProps {
  type: BadgeType;
  children: React.ReactNode;
}

export function StatusBadge({ type, children }: StatusBadgeProps) {
  return (
    <span className={`badge badge-${type}`}>{children}</span>
  );
}
