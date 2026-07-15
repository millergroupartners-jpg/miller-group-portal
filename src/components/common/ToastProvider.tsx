import { createContext, useContext, useRef, useState } from 'react';

type ToastKind = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  kind: ToastKind;
  text: string;
}

interface ToastContextValue {
  success: (text: string) => void;
  error: (text: string) => void;
  info: (text: string) => void;
}

const ToastContext = createContext<ToastContextValue>({
  success: () => {},
  error: () => {},
  info: () => {},
});

const KIND_COLOR: Record<ToastKind, string> = {
  success: 'var(--success)',
  error: 'var(--danger)',
  info: 'var(--gold-text)',
};

const KIND_ICON: Record<ToastKind, string> = {
  success: '✓',
  error: '✕',
  info: 'ℹ',
};

const DISMISS_MS = 3000;
const MAX_VISIBLE = 3;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = (id: number) => {
    const t = timers.current.get(id);
    if (t) { clearTimeout(t); timers.current.delete(id); }
    setToasts(list => list.filter(x => x.id !== id));
  };

  const push = (kind: ToastKind, text: string) => {
    const id = nextId.current++;
    setToasts(list => [...list.slice(-(MAX_VISIBLE - 1)), { id, kind, text }]);
    timers.current.set(id, setTimeout(() => dismiss(id), DISMISS_MS));
  };

  const value: ToastContextValue = {
    success: text => push('success', text),
    error: text => push('error', text),
    info: text => push('info', text),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toasts.length > 0 && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          zIndex: 500, display: 'flex', flexDirection: 'column', gap: 8,
          alignItems: 'center', pointerEvents: 'none', direction: 'rtl',
          width: 'min(420px, calc(100vw - 32px))',
        }}>
          {toasts.map(t => (
            <div
              key={t.id}
              className="glass-panel fade-up"
              onClick={() => dismiss(t.id)}
              style={{
                pointerEvents: 'auto', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 16px', borderRadius: 'var(--radius-sm)',
                maxWidth: '100%',
              }}
            >
              <span style={{
                width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700,
                color: KIND_COLOR[t.kind], border: `1px solid ${KIND_COLOR[t.kind]}`,
              }}>{KIND_ICON[t.kind]}</span>
              <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{t.text}</span>
            </div>
          ))}
        </div>
      )}
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
