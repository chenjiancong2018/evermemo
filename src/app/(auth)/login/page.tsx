'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff } from 'lucide-react';
import { api } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    try {
      await api('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      router.push('/home');
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : '登录失败', 'error');
      setLoading(false);
    }
  }

  return (
    <div className="animate-fade-in">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-white">
          <span className="font-serif text-2xl leading-none">忆</span>
        </div>
        <h1 className="text-[22px] font-semibold">欢迎回到 Evermemo</h1>
        <p className="mt-1.5 text-[13.5px] text-muted">重新走过自己的人生</p>
      </div>

      <form onSubmit={onSubmit} className="card space-y-4 p-6">
        <div>
          <Label htmlFor="email">邮箱</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div>
          <Label htmlFor="password">密码</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPw ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="请输入密码"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="pr-11"
            />
            <button
              type="button"
              onClick={() => setShowPw((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
              aria-label={showPw ? '隐藏密码' : '显示密码'}
            >
              {showPw ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
        </div>
        <Button type="submit" loading={loading} className="w-full">
          登录
        </Button>
        <p className="text-center text-[13px] text-muted">
          <Link href="/recover" className="hover:text-foreground hover:underline">
            忘记密码？用恢复码找回
          </Link>
        </p>
        <p className="text-center text-[13px] text-muted">
          还没有账号？{' '}
          <Link href="/register" className="font-medium text-accent hover:underline">
            创建档案
          </Link>
        </p>
      </form>

      <p className="mt-6 text-center text-[12px] leading-relaxed text-muted/80">
        你的记忆保存在自己的设备上，
        <br />
        随时可以完整导出。
      </p>
    </div>
  );
}
