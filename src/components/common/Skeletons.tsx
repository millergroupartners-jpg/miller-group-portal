/**
 * Skeleton placeholders for initial loads (cold cache). They reuse the
 * existing .skeleton shimmer (components.css) — reduced-motion already
 * disables the shimmer in animations.css. Inline refreshes keep using
 * .mg-spinner; skeletons are only for "nothing on screen yet" states.
 */

export function SkeletonBlock({ w, h, br, style }: {
  w?: number | string;
  h: number;
  br?: number;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className="skeleton"
      style={{ width: w ?? '100%', height: h, borderRadius: br, ...style }}
    />
  );
}

/** Ghost of a property card — matches MondayPropertyCard proportions. */
export function SkeletonPropertyCard() {
  return (
    <div className="gold-card">
      {/* photo area — PropPhoto uses heightRatio 48% */}
      <div className="skeleton" style={{ paddingBottom: '48%', borderRadius: 'var(--radius-card) var(--radius-card) 0 0' }} />
      <div style={{ padding: '10px 14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <SkeletonBlock h={44} style={{ flex: 1 }} />
          <SkeletonBlock h={44} style={{ flex: 1 }} />
          <SkeletonBlock h={44} style={{ flex: 1 }} />
        </div>
        <SkeletonBlock h={8} br={4} style={{ marginTop: 2 }} />
      </div>
    </div>
  );
}

/** Ghost of one activity-feed row (icon square + two text lines). */
export function SkeletonFeedRow() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'row-reverse', alignItems: 'flex-start',
      gap: 10, padding: 10, borderRadius: 10, background: 'var(--bg-chip)',
    }}>
      <SkeletonBlock w={32} h={32} br={8} style={{ flexShrink: 0 }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
        <SkeletonBlock w="60%" h={12} br={6} />
        <SkeletonBlock w="40%" h={10} br={5} />
      </div>
    </div>
  );
}
