'use client';

/**
 * 主题（浅色 / 深色 / 跟随系统）。
 *
 * - 偏好存 localStorage（evermemo-theme），默认跟随系统
 * - 首屏由 layout 里的内联脚本提前设置 data-theme，避免闪烁
 * - 切换时写 data-theme + 同步 <meta name="theme-color">
 */

import { useCallback, useEffect, useState } from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ThemeMode = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'evermemo-theme';

function systemPrefersDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function resolveTheme(mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'system') return systemPrefersDark() ? 'dark' : 'light';
  return mode;
}

export function applyTheme(mode: ThemeMode) {
  if (typeof document === 'undefined') return;
  const resolved = resolveTheme(mode);
  const root = document.documentElement;
  root.dataset.theme = resolved;
  root.style.colorScheme = resolved;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', resolved === 'dark' ? '#171612' : '#F8F7F3');
}

export function getStoredTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'system';
  const raw = window.localStorage.getItem(STORAGE_KEY);
  return raw === 'light' || raw === 'dark' ? raw : 'system';
}

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const [mode, setMode] = useState<ThemeMode>('system');

  useEffect(() => {
    setMode(getStoredTheme());
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      if (getStoredTheme() === 'system') applyTheme('system');
    };
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);

  const choose = useCallback((next: ThemeMode) => {
    setMode(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* 忽略 */
    }
    applyTheme(next);
  }, []);

  const options: { key: ThemeMode; label: string; icon: typeof Sun }[] = [
    { key: 'light', label: '浅色', icon: Sun },
    { key: 'dark', label: '深色', icon: Moon },
    { key: 'system', label: '跟随系统', icon: Monitor },
  ];

  if (compact) {
    // 侧栏底部的小按钮：循环切换 浅色 → 深色 → 跟随系统
    const order: ThemeMode[] = ['light', 'dark', 'system'];
    const Current = options.find((o) => o.key === mode)?.icon ?? Monitor;
    const next = order[(order.indexOf(mode) + 1) % order.length];
    return (
      <button
        type="button"
        onClick={() => choose(next)}
        title={`外观：${options.find((o) => o.key === mode)?.label ?? '跟随系统'}（点击切换）`}
        aria-label="切换外观"
        className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-foreground/5 hover:text-foreground"
      >
        <Current size={16} />
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1.5 rounded-xl border border-border bg-surface p-1">
      {options.map((o) => {
        const active = mode === o.key;
        return (
          <button
            key={o.key}
            type="button"
            onClick={() => choose(o.key)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] transition-colors',
              active ? 'bg-accent text-white' : 'text-muted hover:text-foreground'
            )}
          >
            <o.icon size={14} />
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
