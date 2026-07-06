import { useEffect, useState } from 'react';
import { MGLogo } from '../common/MGLogo';
import { useUser } from '../../context/UserContext';
import { useMondayData } from '../../context/MondayDataContext';
import { DonutChart } from '../charts/DonutChart';
import { HBarChart } from '../charts/HBarChart';
import { listLoans, getLoanForProperty, loanStatusColor, type LoanRecord } from '../../services/loansApi';
import { MOCK_USER } from '../../data/user';

const GOLD = '#C9A84C';

/** Distinct, theme-agnostic series palette (gold first — brand accent). */
const PALETTE = ['#C9A84C', '#579bfc', '#4CAF50', '#a25ddc', '#ff8a65', '#00c4cc', '#e2445c', '#9aa0a6'];

function fmtUSD(n: number): string {
  if (!n) return '$0';
  if (n >= 1_000_000) return '$' + (n / 1_000_000).toFixed(2) + 'M';
  if (n >= 1_000)     return '$' + Math.round(n / 1000) + 'K';
  return '$' + n.toLocaleString('en-US');
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="gold-card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{title}</div>
        {subtitle && <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{subtitle}</div>}
      </div>
      {children}
    </div>
  );
}

export function AnalyticsScreen() {
  const { currentUser } = useUser();
  const { investors: mondayInvestors, loading } = useMondayData();
  const user = currentUser ?? MOCK_USER;

  const mondayInvestor = user.mondayInvestorId
    ? mondayInvestors.find(inv => inv.mondayId === user.mondayInvestorId)
    : null;
  const props = mondayInvestor?.properties ?? [];

  // Renovation loans — client-side board, investor-safe (their own loans)
  const [loans, setLoans] = useState<LoanRecord[]>([]);
  const [loansLoading, setLoansLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    listLoans()
      .then(list => { if (!cancelled) setLoans(list); })
      .catch(err => console.error('loans fetch failed:', err))
      .finally(() => { if (!cancelled) setLoansLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const totalAllIn = props.reduce((s, p) => s + p.allIn, 0);
  const totalArv   = props.reduce((s, p) => s + p.arvRaw, 0);

  const donutSlices = props
    .filter(p => p.allIn > 0)
    .map((p, i) => ({ label: p.address, value: p.allIn, color: PALETTE[i % PALETTE.length] }));

  const valueBars = props
    .filter(p => p.allIn > 0)
    .map(p => ({
      label: `${p.address}${p.arvRaw > p.allIn ? ` · Equity $${(p.arvRaw - p.allIn).toLocaleString('en-US')}` : ''}`,
      value: p.arvRaw,
      color: GOLD,
      valueLabel: `ARV ${fmtUSD(p.arvRaw)}`,
      secondary: { value: p.allIn, color: '#579bfc', valueLabel: fmtUSD(p.allIn) },
    }));

  const yieldBars = props
    .filter(p => p.rentYield !== '—' && parseFloat(p.rentYield) > 0)
    .sort((a, b) => parseFloat(b.rentYield) - parseFloat(a.rentYield))
    .map(p => ({
      label: p.address,
      value: parseFloat(p.rentYield),
      color: '#4CAF50',
      valueLabel: p.rentYield,
    }));

  const propLoans = props
    .map(p => ({ p, loan: getLoanForProperty(loans, p.mondayId, p.address) }))
    .filter((x): x is { p: typeof x.p; loan: LoanRecord } => x.loan !== null);

  const isEmpty = !loading && props.length === 0;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-base)', overflow: 'hidden' }}>
      <div className="desktop-page-title">
        <div className="subtitle">תמונת מצב של תיק ההשקעות שלך</div>
        <h1>אנליטיקות</h1>
      </div>

      <div className="screen-header" style={{ padding: '16px 20px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <MGLogo size={36} showWordmark={false} />
        <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>אנליטיקות</span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {loading && props.length === 0 && !isEmpty && (
          <div style={{ textAlign: 'center', color: GOLD, fontSize: 13, padding: '40px 0' }}>⏳ טוען נתונים...</div>
        )}

        {isEmpty && (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📊</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
              אין עדיין נתונים להצגה
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              ברגע שיהיו נכסים בתיק שלך, הגרפים יופיעו כאן
            </div>
          </div>
        )}

        {props.length > 0 && (
          <>
            {/* ── Portfolio composition ── */}
            {donutSlices.length > 0 && (
              <Section title="הרכב התיק" subtitle="חלוקת ההון המושקע (All-In) בין הנכסים">
                <DonutChart
                  slices={donutSlices}
                  centerTitle={fmtUSD(totalAllIn)}
                  centerSubtitle='סה"כ מושקע'
                />
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-end' }}>
                  {donutSlices.map(s => (
                    <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 6, flexDirection: 'row-reverse' }}>
                      <span style={{ width: 10, height: 10, borderRadius: 3, background: s.color, flexShrink: 0 }} />
                      <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{s.label}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', direction: 'ltr' }}>
                        {totalAllIn > 0 ? Math.round((s.value / totalAllIn) * 100) + '%' : ''}
                      </span>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* ── Invested vs ARV ── */}
            {valueBars.length > 0 && (
              <Section title="מושקע מול שווי (ARV)" subtitle={`שווי תיק כולל ${fmtUSD(totalArv)} · זהב = ARV, כחול = מושקע`}>
                <HBarChart bars={valueBars} />
              </Section>
            )}

            {/* ── Yield per property ── */}
            {yieldBars.length > 0 && (
              <Section title="תשואה שנתית לפי נכס" subtitle="שכירות שנתית חלקי סך ההשקעה">
                <HBarChart bars={yieldBars} />
              </Section>
            )}

            {/* ── Renovation budget utilization ── */}
            {!loansLoading && propLoans.length > 0 && (
              <Section title="ניצול תקציב שיפוץ" subtitle="תקציב לפי קטגוריה וסטטוס המשיכה">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                  {propLoans.map(({ p, loan }) => (
                    <div key={loan.id} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexDirection: 'row-reverse' }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>📍 {p.address}</span>
                        <span style={{ fontSize: 11, color: GOLD, fontWeight: 600, direction: 'ltr' }}>
                          {fmtUSD(loan.drawn)} / {fmtUSD(loan.total)} · {loan.progressPct}%
                        </span>
                      </div>
                      {loan.categories.length > 0 && (
                        <HBarChart
                          bars={loan.categories.filter(c => c.amount > 0).map(c => ({
                            label: c.status ? `${c.label} · ${c.status}` : c.label,
                            value: c.amount,
                            color: loanStatusColor(c.status),
                            valueLabel: fmtUSD(c.amount),
                          }))}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </Section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
