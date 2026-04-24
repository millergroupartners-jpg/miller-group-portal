/**
 * InvestorUtilitiesScreen — top-level "Utilities" menu for investors.
 *
 * Shows all utility accounts across every one of the investor's properties in
 * a single consolidated list, grouped by property. Contains no commission /
 * contractor sensitive data — utilities are inherently neutral info (service
 * companies, account numbers, phones) so the same UI pattern as the admin
 * variant is fine here.
 */

import { useEffect, useMemo, useState } from 'react';
import { useNavigation } from '../../context/NavigationContext';
import { useUser } from '../../context/UserContext';
import { MGLogo } from '../common/MGLogo';
import { listUtilities, utilityIcon, statusColor, type Utility, type UtilityStatus } from '../../services/utilitiesApi';

const GOLD = '#C9A84C';

type StatusFilterKey = UtilityStatus | 'all';

const STATUS_CHIPS: { key: StatusFilterKey; label: string }[] = [
  { key: 'all',             label: 'הכל' },
  { key: 'active',          label: 'פעיל' },
  { key: 'scheduled',       label: 'נקבע להפעלה' },
  { key: 'to-start',        label: 'להקמה' },
];

function fmtDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('he-IL', { day: '2-digit', month: 'short', year: '2-digit' });
}

export function InvestorUtilitiesScreen() {
  const { navigate } = useNavigation();
  const { currentUser } = useUser();
  const investorId = currentUser?.mondayInvestorId || '';

  const [items, setItems] = useState<Utility[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilterKey>('all');

  useEffect(() => {
    if (!investorId) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    listUtilities({ investorId })
      .then(list => { if (!cancelled) { setItems(list); setError(null); } })
      .catch(err => { if (!cancelled) setError(err?.message || 'שגיאה'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [investorId]);

  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    items.forEach(u => { m[u.status] = (m[u.status] || 0) + 1; });
    return m;
  }, [items]);

  const filtered = useMemo(() => {
    if (statusFilter === 'all') return items;
    return items.filter(u => u.status === statusFilter);
  }, [items, statusFilter]);

  const grouped = useMemo(() => {
    const groups = new Map<string, { propertyId: string; propertyName: string; rows: Utility[] }>();
    for (const u of filtered) {
      const key = u.propertyId || u.propertyName || u.id;
      if (!groups.has(key)) {
        groups.set(key, { propertyId: u.propertyId, propertyName: u.propertyName || '—', rows: [] });
      }
      groups.get(key)!.rows.push(u);
    }
    return Array.from(groups.values());
  }, [filtered]);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-base)', overflow: 'hidden' }}>
      <div className="desktop-page-title">
        <div className="subtitle">כל ה-utilities בנכסי ההשקעה שלך</div>
        <h1>Utilities</h1>
      </div>

      <div className="screen-header" style={{ padding: '16px 20px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <MGLogo size={36} showWordmark={false} />
        <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>Utilities</span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 20px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Filter chips */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', flexDirection: 'row-reverse', justifyContent: 'flex-start' }}>
          {STATUS_CHIPS.map(c => {
            const count = c.key === 'all' ? items.length : (counts[c.key] || 0);
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
            אין חשבונות זמינים
          </div>
        )}

        {grouped.map(g => (
          <div key={g.propertyId || g.propertyName} className="gold-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div
              onClick={() => g.propertyId && navigate('property-detail', { propertyId: g.propertyId })}
              style={{
                padding: '12px 14px',
                borderBottom: '1px solid var(--border)',
                background: 'var(--bg-surface)',
                cursor: g.propertyId ? 'pointer' : 'default',
                textAlign: 'right',
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{g.propertyName}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{g.rows.length} חשבונות</div>
            </div>

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
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{u.serviceCompany}</div>
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
        ))}
      </div>
    </div>
  );
}
