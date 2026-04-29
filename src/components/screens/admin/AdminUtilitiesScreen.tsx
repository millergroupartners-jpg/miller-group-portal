/**
 * AdminUtilitiesScreen — cross-property view of every utility account
 * (water / power / gas / sewer / trash) across all investor AND MG deals.
 *
 * Groups accounts by property, filters by status (pending / active / etc),
 * search by address / service company. Each row is clickable and jumps to
 * the property detail.
 */

import { useEffect, useMemo, useState } from 'react';
import { useNavigation } from '../../../context/NavigationContext';
import { useMondayData } from '../../../context/MondayDataContext';
import { MGLogo } from '../../common/MGLogo';
import { listUtilities, utilityIcon, statusColor, type Utility, type UtilityStatus } from '../../../services/utilitiesApi';

type SourceKey = 'investors' | 'mg';

const GOLD = '#C9A84C';

type StatusFilterKey = UtilityStatus | 'all';

const STATUS_CHIPS: { key: StatusFilterKey; label: string }[] = [
  { key: 'active',          label: 'פעיל' },
  { key: 'scheduled',       label: 'נקבע להפעלה' },
  { key: 'to-start',        label: 'להקמה' },
  { key: 'pending-payment', label: 'ממתין לתשלום' },
  { key: 'all',             label: 'הכל' },
];

function fmtDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('he-IL', { day: '2-digit', month: 'short', year: '2-digit' });
}

export function AdminUtilitiesScreen() {
  const { navigate } = useNavigation();
  // Use the already-fetched MG vs investor split from MondayDataContext to
  // classify each utility's property — the propertyGroupId from the utilities
  // API isn't reliable (items(ids:){group} sometimes returns empty).
  const { mgProperties } = useMondayData();
  const mgPropertyIds = useMemo(() => new Set(mgProperties.map(p => p.mondayId)), [mgProperties]);

  const [items, setItems] = useState<Utility[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilterKey>('all');
  const [source, setSource] = useState<SourceKey>('investors');
  const [search, setSearch] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listUtilities()
      .then(list => { if (!cancelled) { setItems(list); setError(null); } })
      .catch(err => { if (!cancelled) setError(err?.message || 'שגיאה'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const sourceCounts = useMemo(() => ({
    investors: items.filter(u => !mgPropertyIds.has(u.propertyId)).length,
    mg:        items.filter(u =>  mgPropertyIds.has(u.propertyId)).length,
  }), [items, mgPropertyIds]);

  const sourceItems = useMemo(() => items.filter(u =>
    source === 'mg' ? mgPropertyIds.has(u.propertyId) : !mgPropertyIds.has(u.propertyId)
  ), [items, source, mgPropertyIds]);

  // Counts per status for filter chip badges
  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    sourceItems.forEach(u => { m[u.status] = (m[u.status] || 0) + 1; });
    return m;
  }, [sourceItems]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sourceItems.filter(u => {
      if (statusFilter !== 'all' && u.status !== statusFilter) return false;
      if (!q) return true;
      return [u.accountNumber, u.serviceCompany, u.propertyName, u.investorName]
        .some(v => (v || '').toLowerCase().includes(q));
    });
  }, [sourceItems, statusFilter, search]);

  // Group filtered rows by property for readability
  const grouped = useMemo(() => {
    const groups = new Map<string, { propertyId: string; propertyName: string; investorName: string; rows: Utility[] }>();
    for (const u of filtered) {
      const key = u.propertyId || u.propertyName || u.id;
      if (!groups.has(key)) {
        groups.set(key, {
          propertyId:   u.propertyId,
          propertyName: u.propertyName || '—',
          investorName: u.investorName,
          rows: [],
        });
      }
      groups.get(key)!.rows.push(u);
    }
    return Array.from(groups.values());
  }, [filtered]);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-base)', overflow: 'hidden' }}>
      <div className="desktop-page-title">
        <div className="subtitle">{items.length} חשבונות · על פני כל הנכסים</div>
        <h1>Utilities</h1>
      </div>

      <div className="screen-header" style={{ padding: '16px 20px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <MGLogo size={36} showWordmark={false} />
        <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>Utilities</span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 20px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Source toggle — investors vs Miller Group */}
        <div style={{
          display: 'inline-flex', gap: 4, padding: 3, borderRadius: 100,
          background: 'var(--bg-chip)', border: '1px solid var(--border)',
          flexDirection: 'row-reverse', alignSelf: 'flex-end',
        }}>
          {([
            { key: 'investors' as SourceKey, label: `משקיעים (${sourceCounts.investors})` },
            { key: 'mg'        as SourceKey, label: `Miller Group (${sourceCounts.mg})` },
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

        {/* Search */}
        <input
          className="mg-input"
          placeholder="חיפוש לפי כתובת, משקיע, ספק או account…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ direction: 'rtl' }}
        />

        {/* Status filter chips — flex-wrap so every chip is reachable on desktop */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', flexDirection: 'row-reverse', justifyContent: 'flex-start' }}>
          {STATUS_CHIPS.map(c => {
            // "הכל" reflects the count after the source toggle, not raw items.
            const count = c.key === 'all' ? sourceItems.length : (counts[c.key] || 0);
            const active = statusFilter === c.key;
            return (
              <button
                key={c.key}
                onClick={() => setStatusFilter(c.key)}
                style={{
                  padding: '6px 12px', borderRadius: 100,
                  background: active ? GOLD : 'var(--bg-chip)',
                  color: active ? '#000' : 'var(--text-secondary)',
                  border: '1px solid var(--border)',
                  fontSize: 11, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                }}
              >
                {c.label}
                <span style={{
                  fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 100,
                  background: active ? 'rgba(0,0,0,0.15)' : 'var(--border)',
                  color: active ? '#000' : 'var(--text-muted)',
                }}>{count}</span>
              </button>
            );
          })}
        </div>

        {loading && <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>טוען…</div>}
        {error && <div style={{ padding: 24, textAlign: 'center', color: '#ff4d4d', fontSize: 13 }}>שגיאה: {error}</div>}
        {!loading && grouped.length === 0 && !error && (
          <div className="gold-card" style={{ padding: 30, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>
            אין חשבונות תואמים
          </div>
        )}

        {grouped.map(g => (
          <div key={g.propertyId || g.propertyName} className="gold-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div
              onClick={() => g.propertyId && navigate('property-detail', { propertyId: g.propertyId })}
              style={{
                padding: '12px 14px', display: 'flex', alignItems: 'center',
                justifyContent: 'space-between', flexDirection: 'row-reverse',
                borderBottom: '1px solid var(--border)',
                cursor: g.propertyId ? 'pointer' : 'default',
                background: 'var(--bg-surface)',
              }}
            >
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{g.propertyName}</div>
                {g.investorName && (
                  <div style={{ fontSize: 11, color: GOLD, marginTop: 2 }}>👤 {g.investorName}</div>
                )}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                {g.rows.length} חשבונות
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {g.rows.map((u, idx) => (
                <div
                  key={u.id}
                  style={{
                    padding: '10px 14px',
                    display: 'flex', flexDirection: 'row-reverse', gap: 10, alignItems: 'center',
                    borderTop: idx === 0 ? 'none' : '1px solid var(--divider)',
                  }}
                >
                  <div style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: `${statusColor(u.status)}18`, border: `1px solid ${statusColor(u.status)}44`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0,
                  }}>{utilityIcon(u.serviceCompany)}</div>

                  <div style={{ flex: 1, textAlign: 'right', minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {u.serviceCompany}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-secondary)', direction: 'ltr', textAlign: 'right' }}>
                      Account: {u.accountNumber}
                    </div>
                    {u.createdAt && (
                      <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 1 }}>
                        נוצר · {fmtDate(u.createdAt)}
                      </div>
                    )}
                  </div>

                  {u.statusHe && (
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 100,
                      background: `${statusColor(u.status)}22`, color: statusColor(u.status), flexShrink: 0,
                    }}>{u.statusHe}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
