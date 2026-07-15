interface Props {
  open: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open, title, message, confirmLabel = 'אישור', cancelLabel = 'ביטול',
  danger = false, busy = false, onConfirm, onCancel,
}: Props) {
  if (!open) return null;
  return (
    <div
      onClick={onCancel}
      style={{
        position: 'fixed', inset: 0, zIndex: 450,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20, direction: 'rtl',
      }}
    >
      <div
        className="gold-card fade-up"
        onClick={e => e.stopPropagation()}
        style={{ width: 'min(380px, 100%)', padding: '22px 22px 18px' }}
      >
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', textAlign: 'right', marginBottom: message ? 8 : 18 }}>
          {title}
        </div>
        {message && (
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, textAlign: 'right', marginBottom: 18 }}>
            {message}
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, flexDirection: 'row-reverse' }}>
          <button
            className="mg-btn"
            onClick={onConfirm}
            disabled={busy}
            style={{
              flex: 1,
              ...(danger ? { background: 'var(--danger)', color: '#fff' } : {}),
            }}
          >
            {busy ? '...' : confirmLabel}
          </button>
          <button className="mg-btn-ghost" onClick={onCancel} disabled={busy} style={{ flex: 1 }}>
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
