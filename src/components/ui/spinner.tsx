'use client';

import { Loader2 } from 'lucide-react';

export function Spinner({ className = '' }: { className?: string }) {
  return <Loader2 size={20} className={`animate-spin text-accent ${className}`} />;
}

export function PageLoading({ label = '加载中…' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24 text-muted">
      <Spinner />
      <span className="text-[13px]">{label}</span>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  hint,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2.5 py-20 text-center">
      {icon && <div className="text-muted/60">{icon}</div>}
      <div className="text-[15px] font-medium text-foreground">{title}</div>
      {hint && <div className="max-w-sm text-[13px] leading-relaxed text-muted">{hint}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
