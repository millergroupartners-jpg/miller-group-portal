/**
 * iOS has no install prompt API — this small modal walks the investor
 * through Safari's share → add-to-home-screen flow instead.
 */

const GOLD = 'var(--gold-text)';

export function InstallIOSModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(8, 8, 11, 0.6)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}
    >
      <div
        className="gold-card fade-up"
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: 380, width: '100%', padding: '24px 22px', textAlign: 'right' }}
      >
        <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 6 }}>
          התקנה על מסך הבית
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 16 }}>
          בדפדפן ספארי, בשני צעדים:
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexDirection: 'row-reverse' }}>
            <div style={{
              width: 34, height: 34, borderRadius: 'var(--radius-sm)', background: 'var(--bg-chip)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              {/* iOS share icon */}
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
                stroke={GOLD} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" />
                <polyline points="16 6 12 2 8 6" />
                <line x1="12" y1="2" x2="12" y2="15" />
              </svg>
            </div>
            <span style={{ fontSize: 13.5, color: 'var(--text-primary)', flex: 1 }}>
              1. לוחצים על כפתור השיתוף בסרגל של ספארי
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexDirection: 'row-reverse' }}>
            <div style={{
              width: 34, height: 34, borderRadius: 'var(--radius-sm)', background: 'var(--bg-chip)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
                stroke={GOLD} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="4" />
                <line x1="12" y1="8" x2="12" y2="16" />
                <line x1="8" y1="12" x2="16" y2="12" />
              </svg>
            </div>
            <span style={{ fontSize: 13.5, color: 'var(--text-primary)', flex: 1 }}>
              2. בוחרים "הוסף למסך הבית"
            </span>
          </div>
        </div>

        <button className="mg-btn" onClick={onClose} style={{ padding: 12 }}>
          הבנתי
        </button>
      </div>
    </div>
  );
}
