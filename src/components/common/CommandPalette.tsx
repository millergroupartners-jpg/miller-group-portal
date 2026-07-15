import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigation } from '../../context/NavigationContext';
import { useMondayData } from '../../context/MondayDataContext';
import type { MondayInvestor, MondayProperty } from '../../services/mondayApi';

const GOLD = 'var(--gold-text)';
const MAX_PER_GROUP = 8;

interface Result {
  key: string;
  kind: 'investor' | 'property';
  title: string;
  subtitle: string;
  go: () => void;
}

/**
 * Admin-only global quick search (Ctrl/Cmd+K). Matches investors and
 * properties from the already-loaded MondayDataContext — no extra fetches.
 * The parent gates mounting (admins only, not while impersonating), so the
 * hotkey and the data never exist for investor sessions.
 */
export function CommandPalette({ open, onOpen, onClose }: {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
}) {
  const { navigate } = useNavigation();
  const { investors, properties, mgProperties } = useMondayData();
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Global hotkey — registered while mounted (i.e. for admins only).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onOpen();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onOpen]);

  // Reset + focus on open
  useEffect(() => {
    if (open) {
      setQuery('');
      setHighlight(0);
      const t = setTimeout(() => inputRef.current?.focus(), 30);
      return () => clearTimeout(t);
    }
  }, [open]);

  const results = useMemo<Result[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const invResults: Result[] = investors
      .filter(i => i.fullName.toLowerCase().includes(q) || i.email.toLowerCase().includes(q))
      .slice(0, MAX_PER_GROUP)
      .map((i: MondayInvestor) => ({
        key: `inv-${i.mondayId}`,
        kind: 'investor',
        title: i.fullName,
        subtitle: i.email || `${i.properties.length} נכסים`,
        go: () => navigate('admin-investor-detail', { investorId: i.mondayId }),
      }));
    const propResults: Result[] = [...properties, ...mgProperties]
      .filter(p =>
        p.address.toLowerCase().includes(q) ||
        p.city.toLowerCase().includes(q) ||
        (p.investorName ?? '').toLowerCase().includes(q))
      .slice(0, MAX_PER_GROUP)
      .map((p: MondayProperty) => ({
        key: `prop-${p.mondayId}`,
        kind: 'property',
        title: p.address,
        subtitle: [p.city, p.status, p.investorName].filter(Boolean).join(' · '),
        go: () => navigate('property-detail', { propertyId: p.mondayId }),
      }));
    return [...invResults, ...propResults];
  }, [query, investors, properties, mgProperties, navigate]);

  const clampedHighlight = Math.min(highlight, Math.max(0, results.length - 1));

  const pick = (r: Result) => {
    onClose();
    r.go();
  };

  if (!open) return null;

  const groups: { label: string; items: Result[] }[] = [
    { label: 'משקיעים', items: results.filter(r => r.kind === 'investor') },
    { label: 'נכסים',   items: results.filter(r => r.kind === 'property') },
  ].filter(g => g.items.length > 0);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 350,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex', justifyContent: 'center', alignItems: 'flex-start',
        paddingTop: '15vh', direction: 'rtl',
      }}
    >
      <div
        className="glass-panel fade-up"
        onClick={e => e.stopPropagation()}
        style={{
          width: 'min(560px, calc(100vw - 32px))',
          maxHeight: '60vh', display: 'flex', flexDirection: 'column',
          borderRadius: 'var(--radius-md, 14px)', overflow: 'hidden',
        }}
      >
        <div style={{ padding: 12, borderBottom: '1px solid var(--border)' }}>
          <input
            ref={inputRef}
            className="mg-input"
            placeholder="חיפוש משקיע או נכס…"
            value={query}
            onChange={e => { setQuery(e.target.value); setHighlight(0); }}
            onKeyDown={e => {
              if (e.key === 'Escape') { onClose(); return; }
              if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight(h => Math.min(h + 1, results.length - 1)); }
              if (e.key === 'ArrowUp')   { e.preventDefault(); setHighlight(h => Math.max(h - 1, 0)); }
              if (e.key === 'Enter' && results[clampedHighlight]) pick(results[clampedHighlight]);
            }}
            style={{ direction: 'rtl' }}
          />
        </div>

        <div style={{ overflowY: 'auto', padding: '6px 8px 10px' }}>
          {query.trim() && results.length === 0 && (
            <div style={{ padding: '18px 0', textAlign: 'center', fontSize: 13, color: 'var(--text-secondary)' }}>
              לא נמצאו תוצאות
            </div>
          )}
          {!query.trim() && (
            <div style={{ padding: '18px 0', textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
              הקלד שם משקיע, כתובת נכס או עיר
            </div>
          )}
          {groups.map(g => (
            <div key={g.label}>
              <div style={{ padding: '8px 10px 4px', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: 0.5 }}>
                {g.label}
              </div>
              {g.items.map(r => {
                const idx = results.indexOf(r);
                const isHl = idx === clampedHighlight;
                return (
                  <div
                    key={r.key}
                    className="interactive"
                    onClick={() => pick(r)}
                    onMouseEnter={() => setHighlight(idx)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, flexDirection: 'row-reverse',
                      padding: '9px 10px', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                      background: isHl ? 'var(--gold-dim)' : 'transparent',
                    }}
                  >
                    <span style={{
                      width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: 'var(--bg-chip)', border: '1px solid var(--border)', fontSize: 13,
                    }}>{r.kind === 'investor' ? '👤' : '🏠'}</span>
                    <div style={{ flex: 1, minWidth: 0, textAlign: 'right' }}>
                      <div style={{
                        fontSize: 13, fontWeight: 600, color: isHl ? GOLD : 'var(--text-primary)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>{r.title}</div>
                      <div style={{
                        fontSize: 11, color: 'var(--text-secondary)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>{r.subtitle}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <div style={{
          padding: '7px 12px', borderTop: '1px solid var(--border)',
          fontSize: 10, color: 'var(--text-muted)', display: 'flex', gap: 14, flexDirection: 'row-reverse',
        }}>
          <span>↑↓ ניווט</span>
          <span>Enter בחירה</span>
          <span>Esc סגירה</span>
        </div>
      </div>
    </div>
  );
}
