/**
 * Shared presentational pieces for a single renovation loan, reused by the
 * per-property LoanTab and the admin AdminLoansScreen so the summary + category
 * breakdown render identically in both places.
 */

import { ProgressBar } from './ProgressBar';
import { loanStatusColor, type LoanRecord } from '../../services/loansApi';

const GOLD = 'var(--gold-text)';

export function fmtMoney(n: number): string {
  return '$' + (n || 0).toLocaleString('en-US');
}

/** Four headline KPIs + the renovation-progress bar for one loan. */
export function LoanSummary({ loan }: { loan: LoanRecord }) {
  const kpis = [
    { label: 'סה״כ הלוואה',  value: fmtMoney(loan.total),       c: 'var(--text-primary)' },
    { label: 'כבר נמשך',     value: fmtMoney(loan.drawn),       c: 'var(--success)' },
    { label: 'נשאר בהלוואה', value: fmtMoney(loan.remaining),   c: GOLD },
    { label: 'מוכן למשיכה',  value: fmtMoney(loan.readyToDraw), c: 'var(--info)' },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10 }}>
        {kpis.map(k => (
          <div key={k.label} className="stat-chip" style={{ textAlign: 'center', padding: '12px 14px' }}>
            <div className="stat-label">{k.label}</div>
            <div className="stat-value num" style={{ fontSize: 16, fontWeight: 800, color: k.c }}>{k.value}</div>
          </div>
        ))}
      </div>
      <div className="gold-card" style={{ padding: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 12, color: GOLD, fontWeight: 700 }}>{loan.progressPct}%</span>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>התקדמות שיפוץ</span>
        </div>
        <ProgressBar target={loan.progressPct} />
      </div>
    </div>
  );
}

function StatusChip({ status }: { status: string }) {
  if (!status) return null;
  const c = loanStatusColor(status);
  return (
    <span style={{
      fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 100,
      background: `${c}22`, color: c, whiteSpace: 'nowrap',
    }}>{status}</span>
  );
}

/** Per-category cost breakdown ($ categories) + extra scope items (note + status). */
export function LoanCategoryBreakdown({ loan }: { loan: LoanRecord }) {
  if (loan.categories.length === 0 && loan.scope.length === 0) {
    return (
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', padding: 10, textAlign: 'center' }}>
        אין פירוט קטגוריות עדיין
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {loan.categories.map(c => (
        <div key={c.label} style={{
          display: 'flex', flexDirection: 'row-reverse', alignItems: 'center', gap: 10,
          padding: '10px 12px', borderRadius: 10, background: 'var(--bg-chip)',
        }}>
          <div style={{ flex: 1, textAlign: 'right', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{c.label}</div>
          <StatusChip status={c.status} />
          <div className="num" style={{ fontSize: 14, fontWeight: 800, color: c.amount > 0 ? 'var(--success)' : 'var(--text-muted)', minWidth: 64, textAlign: 'left' }}>
            {c.amount > 0 ? fmtMoney(c.amount) : '—'}
          </div>
        </div>
      ))}

      {loan.scope.length > 0 && (
        <>
          <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 6, textAlign: 'right', letterSpacing: 0.3 }}>
            עבודות נוספות
          </div>
          {loan.scope.map(c => (
            <div key={c.label} style={{
              display: 'flex', flexDirection: 'row-reverse', alignItems: 'center', gap: 10,
              padding: '8px 12px', borderRadius: 10, background: 'var(--bg-chip)',
            }}>
              <div style={{ flex: 1, textAlign: 'right' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{c.label}</div>
                {c.note && <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>{c.note}</div>}
              </div>
              <StatusChip status={c.status} />
            </div>
          ))}
        </>
      )}
    </div>
  );
}
