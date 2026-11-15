'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';

export default function RecoverPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    if (pw.length < 8) {
      toast('新密码至少 8 位', 'error');
      return;
    }
    if (pw !== confirm) {
      toast('两次输入的新密码不一致', 'error');
      return;
    }
    setLoading(true);
    try {
      await api('/api/auth/recover', {
        method: 'POST',
        body: JSON.stringify({ email, recovery_code: code, new_password: pw }),
      });
      toast('口令已重设，欢迎回来', 'success');
      router.push('/home');
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : '找回失败', 'error');
      setLoading(false);
    }
  }

  return (
    <div className="animate-fade-in">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-white">
          <span className="font-serif text-2xl leading-none">忆</span>
        </div>
        <h1 className="text-[22px] font-semibold">用恢复码找回</h1>
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted">
          输入恢复码并为账号设置新密码，
          <br />
          已加密封存的记忆胶囊会继续保留。
        </p>
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
          <Label htmlFor="recovery_code">恢复码</Label>
          <Input
            id="recovery_code"
            placeholder="例如 XXXX-XXXX-XXXX-…"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            autoComplete="one-time-code"
            spellCheck={false}
            required
          />
          <p className="mt-1.5 text-[12px] leading-relaxed text-muted">
            在「设置 → 恢复码」生成的那串字符，大小写和横线都可以忽略。
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="new_password">新密码（至少 8 位）</Label>
            <Input
              id="new_password"
              type="password"
              autoComplete="new-password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="confirm">确认新密码</Label>
            <Input
              id="confirm"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
          </div>
        </div>
        <Button type="submit" loading={loading} className="w-full">
          重设密码并登录
        </Button>
        <p className="text-center text-[13px] text-muted">
          恢复码使用一次后会自动失效。想起来了？
          <Link href="/login" className="ml-1 font-medium text-accent hover:underline">
            返回登录
          </Link>
        </p>
      </form>

      <p className="mt-6 text-center text-[12px] leading-relaxed text-muted/80">
        恢复码只可使用一次，请把它保存在安全的地方，
        <br />
        不要截图或转发给任何人。
      </p>
    </div>
  );
}
