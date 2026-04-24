import { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigation } from '../../../context/NavigationContext';
import { useMondayData } from '../../../context/MondayDataContext';
import { MGLogo } from '../../common/MGLogo';
import { StatusBadge } from '../../common/StatusBadge';
import { ProgressBar } from '../../common/ProgressBar';
import { PropPhoto } from '../../common/PropPhoto';
import { useCCThumbnail } from '../../../hooks/useCCThumbnail';
import type { MondayProperty } from '../../../services/mondayApi';

const NEEDS_MANAGER_STATUSES = ['מעבר לניהול', 'מרקט', 'מושכר'];
function needsManager(p: MondayProperty): boolean {
  return NEEDS_MANAGER_STATUSES.includes(p.status)
    && !(p.managerContactName || p.managerCompanyName || p.managerPhone || p.managerEmail);
}

const GOLD = '#C9A84C';

const STATUS_FILTERS = ['הכל', 'חסר מנהל', 'על חוזה', 'בשלבי הלוואה וחתימות', 'בשיפוץ', 'מעבר לניהול', 'מרקט', 'מושכר'];

function Card({ p, i, flash }: { p: MondayProperty; i: number; flash?: boolean }) {
  const thumb = useCCThumbnail(p.address);
  const { navigate } = useNavigation();
  return (
    <div
      className={`gold-card${flash ? ' flash-highlight' : ''}`}
      data-flash={flash ? 'true' : undefined}
      style={{ cursor: 'pointer' }}
      onClick={() => navigate('property-detail', { propertyId: p.mondayId })}
    >
      <div style={{ position: 'relative' }}>
        <PropPhoto index={i} heightRatio={48} photoUrl={thumb} />
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          background: 'linear-gradient(transparent, rgba(0,0,0,0.75))',
          padding: '18px 12px 10px',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
            <StatusBadge type={p.statusType}>{p.status}</StatusBadge>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', lineHeight: 1.3 }}>{p.address}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', marginTop: 2 }}>{p.city}</div>
            </div>
          </div>
        </div>
      </div>
      <div style={{ padding: '10px 14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {p.investorName && (
          <div style={{ fontSize: 11, color: GOLD, fontWeight: 600, textAlign: 'right' }}>
            👤 {p.investorName}
          </div>
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ background: 'var(--bg-chip)', borderRadius: 10, padding: '8px 12px', flex: 1 }}>
            <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginBottom: 3 }}>מחיר קנייה</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{p.purchasePrice}</div>
          </div>
          <div style={{ background: 'var(--bg-chip)', borderRadius: 10, padding: '8px 12px', flex: 1 }}>
            <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginBottom: 3 }}>ARV</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: GOLD }}>{p.arv}</div>
          </div>
          <div style={{ background: 'var(--bg-chip)', borderRadius: 10, padding: '8px 12px', flex: 1 }}>
            <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginBottom: 3 }}>Equity</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#4CAF50' }}>
              {p.arvRaw > 0 && p.allIn > 0 ? '$' + (p.arvRaw - p.allIn).toLocaleString('en-US') : '—'}
            </div>
          </div>
        </div>
        {p.statusType !== 'blue' && (
          <div style={{ marginTop: 2 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 10, color: GOLD, fontWeight: 600 }}>{p.progress}%</span>
              <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>התקדמות</span>
            </div>
            <ProgressBar target={p.progress} height={8} />
          </div>
        )}
      </div>
    </div>
  );
}

/** Which data source the admin wants to see — investor-owned deals or
 *  Miller Group's own. Previously two separate sidebar tabs; merged here
 *  to free a slot for Utilities. */
type PropertySource = 'investors' | 'mg';

export function AdminPropertiesScreen() {
  const { properties, mgProperties, loading } = useMondayData();
  const { navState } = useNavigation();
  const highlightMode = navState.highlightPropertyMode;
  const [statusFilter, setStatusFilter] = useState<string>(() =>
    highlightMode === 'no-manager' ? 'חסר מנהל' : 'הכל',
  );
  const [search, setSearch] = useState('');
  const [source, setSource] = useState<PropertySource>('investors');
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // When admin came in from the "missing manager" alert, also include MG properties
  // so they can fix them from one screen. Otherwise, the source toggle picks
  // exactly one set.
  const allProperties: MondayProperty[] = useMemo(() => {
    if (highlightMode === 'no-manager') return [...properties, ...mgProperties];
    return source === 'mg' ? mgProperties : properties;
  }, [properties, mgProperties, highlightMode, source]);

  const filtered = allProperties.filter(p => {
    if (statusFilter === 'חסר מנהל') {
      if (!needsManager(p)) return false;
    } else if (statusFilter !== 'הכל' && p.status !== statusFilter) {
      return false;
    }
    if (search) {
      const s = search.toLowerCase();
      return p.address.toLowerCase().includes(s) ||
             p.city.toLowerCase().includes(s) ||
             (p.investorName ?? '').toLowerCase().includes(s);
    }
    return true;
  });

  // Set of property IDs to flash when we arrive from the alert
  const flashIds = useMemo(() => {
    if (highlightMode !== 'no-manager') return new Set<string>();
    return new Set(allProperties.filter(needsManager).map(p => p.mondayId));
  }, [highlightMode, allProperties]);

  // Scroll to first flashed card after the list renders
  useEffect(() => {
    if (flashIds.size === 0) return;
    const t = window.setTimeout(() => {
      const container = scrollContainerRef.current;
      if (!container) return;
      const first = container.querySelector('[data-flash="true"]') as HTMLElement | null;
      first?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 350);
    return () => window.clearTimeout(t);
  }, [flashIds.size]);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-base)', overflow: 'hidden' }}>
      <div className="desktop-page-title">
        <div className="subtitle">
          {source === 'mg'
            ? `${mgProperties.length} עסקאות Miller Group`
            : `${properties.length} עסקאות של משקיעים`}
        </div>
        <h1>{source === 'mg' ? 'נכסי Miller Group' : 'נכסי משקיעים'}</h1>
      </div>

      <div className="screen-header" style={{ padding: '16px 20px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <MGLogo size={36} showWordmark={false} />
        <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>
          {source === 'mg' ? 'נכסי Miller Group' : 'נכסי משקיעים'}
        </span>
      </div>

      {/* Source toggle — investors / Miller Group. Hidden when admin landed here
          from the "missing manager" alert since that view intentionally spans
          both sets. */}
      {highlightMode !== 'no-manager' && (
        <div style={{ padding: '6px 20px 0', flexShrink: 0 }}>
          <div style={{
            display: 'inline-flex', gap: 4, padding: 3, borderRadius: 100,
            background: 'var(--bg-chip)', border: '1px solid var(--border)',
            flexDirection: 'row-reverse',
          }}>
            {([
              { key: 'investors' as PropertySource, label: `משקיעים (${properties.length})` },
              { key: 'mg'        as PropertySource, label: `Miller Group (${mgProperties.length})` },
            ]).map(opt => (
              <button
                key={opt.key}
                onClick={() => setSource(opt.key)}
                style={{
                  padding: '6px 14px', borderRadius: 100, border: 'none',
                  background: source === opt.key ? GOLD : 'transparent',
                  color: source === opt.key ? '#000' : 'var(--text-secondary)',
                  fontSize: 11, fontWeight: 700, cursor: 'pointer',
                  transition: 'background 0.15s',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Search */}
      <div style={{ padding: '12px 20px 0', flexShrink: 0 }}>
        <input
          className="mg-input"
          placeholder="חיפוש לפי כתובת, עיר או שם משקיע..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ fontSize: 14, padding: '10px 14px' }}
        />
      </div>

      {/* Status filter chips */}
      <div style={{ padding: '12px 20px 0', display: 'flex', gap: 6, overflowX: 'auto', flexShrink: 0 }}>
        {STATUS_FILTERS.map(status => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            style={{
              flexShrink: 0,
              padding: '6px 12px', borderRadius: 100,
              border: statusFilter === status ? 'none' : '1px solid var(--border)',
              background: statusFilter === status ? GOLD : 'var(--bg-chip)',
              color: statusFilter === status ? '#000' : 'var(--text-secondary)',
              fontSize: 11, fontWeight: 600, cursor: 'pointer',
              fontFamily: 'var(--font-ui)',
            }}
          >
            {status}
          </button>
        ))}
      </div>

      <div ref={scrollContainerRef} style={{ flex: 1, overflowY: 'auto', padding: '14px 20px 20px' }}>
        {loading && <div style={{ textAlign: 'center', color: GOLD, fontSize: 13, padding: '40px 0' }}>⏳ טוען...</div>}
        {!loading && filtered.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13, padding: '40px 0' }}>
            אין נכסים בסינון זה
          </div>
        )}
        <div className="property-grid" style={{ padding: 0 }}>
          {filtered.map((p, i) => (
            <Card key={p.mondayId} p={p} i={i} flash={flashIds.has(p.mondayId)} />
          ))}
        </div>
      </div>
    </div>
  );
}
