'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  /** 点击遮罩关闭 */
  dismissable?: boolean;
  wide?: boolean;
}

export function Dialog({ open, onClose, title, children, dismissable = true, wide = false }: DialogProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-black/45 backdrop-blur-[2px] animate-fade-in sm:items-center sm:p-6"
      onClick={dismissable ? onClose : undefined}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`animate-slide-up max-h-[92dvh] w-full overflow-y-auto rounded-t-2xl bg-surface shadow-2xl sm:rounded-2xl ${
          wide ? 'sm:max-w-2xl' : 'sm:max-w-md'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {title !== undefined && (
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-surface px-5 py-4">
            <h2 className="text-[16px] font-semibold">{title}</h2>
            <button onClick={onClose} className="rounded-lg p-1.5 text-muted hover:bg-foreground/5 hover:text-foreground" aria-label="关闭">
              <X size={18} />
            </button>
          </div>
        )}
        <div className="p-5">{children}</div>
      </div>
    </div>,
    document.body
  );
}
