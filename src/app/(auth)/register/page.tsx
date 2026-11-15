'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff } from 'lucide-react';
import { api } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';

export default function RegisterPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    if (password !== confirm) {
      toast('两次输入的密码不一致', 'error');
      return;
    }
    setLoading(true);
    try {
      await api('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password, display_name: displayName }),
      });
      toast('档案创建成功，欢迎来到 Evermemo', 'success');
      router.push('/home');
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : '注册失败', 'error');
      setLoading(false);
    }
  }

  return (
    <div className="animate-fade-in">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-white">
          <span className="font-serif text-2xl leading-none">忆</span>
        </div>
        <h1 className="text-[22px] font-semibold">创建你的人生档案</h1>
        <p className="mt-1.5 text-[13.5px] text-muted">从今天开始，认真收藏每一天</p>
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
          <Label htmlFor="name">昵称（可选）</Label>
          <Input
            id="name"
            placeholder="大家怎么称呼你"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={40}
          />
        </div>
        <div>
          <Label htmlFor="password">密码</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPw ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="至少 8 位"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
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
        <div>
          <Label htmlFor="confirm">确认密码</Label>
          <Input
            id="confirm"
            type={showPw ? 'text' : 'password'}
            autoComplete="new-password"
            placeholder="再输入一次"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
        </div>
        <Button type="submit" loading={loading} className="w-full">
          创建档案
        </Button>
        <p className="text-center text-[13px] text-muted">
          已有账号？{' '}
          <Link href="/login" className="font-medium text-accent hover:underline">
            直接登录
          </Link>
        </p>
      </form>
    </div>
  );
}
