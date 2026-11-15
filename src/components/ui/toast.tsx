'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

type ToastKind = 'success' | 'error' | 'info';
interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastContextValue {
  toast: (message: string, kind?: ToastKind) => void;
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

const ICONS: Record<ToastKind, React.ReactNode> = {
  success: <CheckCircle2 size={17} className="text-[#6f8f6a]" />,
  error: <AlertCircle size={17} className="text-danger" />,
  info: <Info size={17} className="text-accent" />,
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const toast = useCallback((message: string, kind: ToastKind = 'info') => {
    const id = nextId.current++;
    setItems((prev) => [...prev.slice(-3), { id, kind, message }]);
    setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed bottom-20 left-1/2 z-[100] flex w-[min(92vw,420px)] -translate-x-1/2 flex-col items-center gap-2 md:bottom-8">
        {items.map((t) => (
          <div
            key={t.id}
            className="animate-slide-up pointer-events-auto flex w-full items-center gap-2.5 rounded-xl border border-border bg-surface px-4 py-3 text-[13.5px] shadow-lg"
            role="status"
          >
            {ICONS[t.kind]}
            <span className="flex-1 leading-snug">{t.message}</span>
            <button
              onClick={() => setItems((prev) => prev.filter((x) => x.id !== t.id))}
              className="text-muted hover:text-foreground"
              aria-label="关闭"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
