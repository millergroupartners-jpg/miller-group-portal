/**
 * Utilities tab on PropertyDetailScreen.
 * Shows utility ACCOUNTS (water / power / gas / sewer / trash) linked to this
 * property on the Monday "utilities" board. Visible to both admin and investor —
 * contains no commission-sensitive data.
 */

import { useEffect, useState } from 'react';
import { listUtilities, utilityIcon, statusColor, type Utility } from '../../../services/utilitiesApi';

const GOLD = '#C9A84C';

function fmtDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('he-IL', { day: '2-digit', month: 'short', year: '2-digit' });
}

interface Props {
  propertyId: string;
}

export function UtilitiesTab({ propertyId }: Props) {
  const [items, setItems] = useState<Utility[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listUtilities({ propertyId })
      .then(list => { if (!cancelled) { setItems(list); setError(null); } })
      .catch(err => { if (!cancelled) setError(err?.message || 'שגיאה בטעינה'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [propertyId]);

  if (loading) {
    return <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>טוען…</div>;
  }
  if (error) {
    return <div style={{ padding: 24, textAlign: 'center', color: '#ff4d4d', fontSize: 13 }}>שגיאה: {error}</div>;
  }
  if (items.length === 0) {
    return (
      <div style={{ padding: '24px 14px', textAlign: 'center', color: 'var(--text-secondary)' }}>
        <div style={{ fontSize: 36, marginBottom: 10 }}>🔌</div>
        <div style={{ fontSize: 13 }}>אין utilities מקושרים לנכס זה עדיין</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
      {items.map(u => (
        <div key={u.id} className="gold-card" style={{ padding: 14 }}>
          <div style={{ display: 'flex', flexDirection: 'row-reverse', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: `${statusColor(u.status)}18`,
              border: `1px solid ${statusColor(u.status)}44`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0,
            }}>
              {utilityIcon(u.serviceCompany)}
            </div>
            <div style={{ flex: 1, textAlign: 'right' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 3 }}>
                {u.serviceCompany || 'Utility'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', direction: 'ltr', textAlign: 'right' }}>
                Account: {u.accountNumber || '—'}
              </div>
            </div>
            {u.statusHe && (
              <span style={{
                fontSize: 10, fontWeight: 700, padding: '4px 10px', borderRadius: 100,
                background: `${statusColor(u.status)}22`, color: statusColor(u.status), flexShrink: 0,
              }}>
                {u.statusHe}
              </span>
            )}
          </div>

          {(u.scheduledIn || u.phone || u.website) && (
            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {u.scheduledIn && (
                <div style={{
                  background: 'var(--bg-chip)', borderRadius: 8, padding: '7px 10px',
                  display: 'flex', flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>תאריך הפעלה</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{fmtDate(u.scheduledIn)}</span>
                </div>
              )}
              {u.phone && (
                <a href={`tel:${u.phone}`} style={{
                  background: 'var(--bg-chip)', borderRadius: 8, padding: '7px 10px',
                  display: 'flex', flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center',
                  textDecoration: 'none',
                }}>
                  <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>טלפון</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: GOLD, direction: 'ltr' }}>{u.phone}</span>
                </a>
              )}
              {u.website && (
                <a href={u.website.startsWith('http') ? u.website : `https://${u.website}`} target="_blank" rel="noopener noreferrer" style={{
                  background: 'var(--bg-chip)', borderRadius: 8, padding: '7px 10px',
                  display: 'flex', flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center',
                  textDecoration: 'none',
                }}>
                  <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>אתר</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: GOLD }}>פתח ↗</span>
                </a>
              )}
            </div>
          )}

          {u.notes && (
            <div style={{ marginTop: 10, padding: '10px 12px', background: 'var(--bg-chip)', borderRadius: 8, fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6, textAlign: 'right' }}>
              {u.notes}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
