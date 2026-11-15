'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Download, LogOut, Palette, ShieldCheck, User } from 'lucide-react';
import { api } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Input, Label, Textarea } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { RecoverySection } from '@/components/settings/RecoverySection';

interface SettingsViewProps {
  user: {
    email: string;
    display_name: string | null;
    bio: string | null;
    created_at: string;
  };
}

export function SettingsView({ user }: SettingsViewProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [name, setName] = useState(user.display_name ?? '');
  const [bio, setBio] = useState(user.bio ?? '');
  const [savingProfile, setSavingProfile] = useState(false);

  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [savingPw, setSavingPw] = useState(false);

  async function saveProfile() {
    setSavingProfile(true);
    try {
      await api('/api/profile', {
        method: 'PUT',
        body: JSON.stringify({ display_name: name, bio }),
      });
      toast('资料已保存', 'success');
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : '保存失败', 'error');
    } finally {
      setSavingProfile(false);
    }
  }

  async function changePassword() {
    if (newPw.length < 8) {
      toast('新密码至少 8 位', 'error');
      return;
    }
    if (newPw !== confirmPw) {
      toast('两次输入的新密码不一致', 'error');
      return;
    }
    setSavingPw(true);
    try {
      await api('/api/auth/password', {
        method: 'PUT',
        body: JSON.stringify({ old_password: oldPw, new_password: newPw }),
      });
      toast('密码已修改，其他设备已退出登录', 'success');
      setOldPw('');
      setNewPw('');
      setConfirmPw('');
    } catch (err) {
      toast(err instanceof Error ? err.message : '修改失败', 'error');
    } finally {
      setSavingPw(false);
    }
  }

  async function logout() {
    try {
      await api('/api/auth/logout', { method: 'POST' });
    } catch {
      /* 忽略 */
    }
    router.push('/login');
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-[680px] space-y-5">
      {/* 个人资料 */}
      <section className="card p-5 sm:p-6">
        <h2 className="mb-1 flex items-center gap-2 text-[16px] font-semibold">
          <User size={17} className="text-accent" />
          个人资料
        </h2>
        <p className="mb-4 text-[12.5px] text-muted">这些信息只显示给你自己看。</p>
        <div className="space-y-4">
          <div>
            <Label>邮箱</Label>
            <Input value={user.email} disabled className="opacity-60" />
          </div>
          <div>
            <Label>昵称</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="你的名字"
              maxLength={50}
            />
          </div>
          <div>
            <Label>简介（可选）</Label>
            <Textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="一句话介绍自己"
              rows={3}
              maxLength={500}
            />
          </div>
          <Button onClick={saveProfile} loading={savingProfile}>
            保存资料
          </Button>
        </div>
      </section>

      {/* 修改密码 */}
      <section className="card p-5 sm:p-6">
        <h2 className="mb-1 flex items-center gap-2 text-[16px] font-semibold">
          <ShieldCheck size={17} className="text-accent" />
          修改密码
        </h2>
        <p className="mb-4 text-[12.5px] text-muted">修改后，其他设备上的登录会全部失效。</p>
        <div className="space-y-4">
          <div>
            <Label>当前密码</Label>
            <Input
              type="password"
              value={oldPw}
              onChange={(e) => setOldPw(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>新密码（至少 8 位）</Label>
              <Input
                type="password"
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            <div>
              <Label>确认新密码</Label>
              <Input
                type="password"
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                autoComplete="new-password"
              />
            </div>
          </div>
          <Button onClick={changePassword} loading={savingPw}>
            修改密码
          </Button>
        </div>
      </section>

      {/* 恢复码 */}
      <RecoverySection />

      {/* 外观 */}
      <section className="card p-5 sm:p-6">
        <h2 className="mb-1 flex items-center gap-2 text-[16px] font-semibold">
          <Palette size={17} className="text-accent" />
          外观
        </h2>
        <p className="mb-4 text-[12.5px] text-muted">浅色适合白天，深色适合夜里安静地写字。</p>
        <ThemeToggle />
      </section>

      {/* 数据 */}
      <section className="card p-5 sm:p-6">
        <h2 className="mb-1 flex items-center gap-2 text-[16px] font-semibold">
          <Download size={17} className="text-accent" />
          数据与备份
        </h2>
        <p className="mb-4 text-[12.5px] leading-relaxed text-muted">
          Evermemo 的数据保存在你自己的设备上，不会上传到任何服务器。建议定期导出
          JSON 备份，完整内容包含所有记录、标签、照片与拍摄时间。
        </p>
        <div className="flex flex-wrap gap-2">
          <a href="/api/export" className="btn-secondary inline-flex">
            <Download size={15} />
            导出全部数据（JSON）
          </a>
          <a href="/api/export/photos" className="btn-secondary inline-flex">
            <Download size={15} />
            打包照片（ZIP）
          </a>
        </div>
      </section>

      {/* 退出 */}
      <section className="card flex items-center justify-between p-5 sm:p-6">
        <div>
          <div className="text-[14.5px] font-medium">退出登录</div>
          <div className="mt-0.5 text-[12.5px] text-muted">此设备将退出，数据不受影响</div>
        </div>
        <Button variant="danger" onClick={logout}>
          <LogOut size={15} />
          退出
        </Button>
      </section>
    </div>
  );
}
