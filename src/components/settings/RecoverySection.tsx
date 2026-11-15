'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, Copy, Download, KeyRound, ShieldOff } from 'lucide-react';
import { api } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input, Label } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';

/**
 * 「恢复码」分区：忘记登录口令时，凭恢复码找回账号并重设口令。
 *
 * - 恢复码只在生成时显示一次，服务端只保存用恢复码包裹的数据密钥；
 * - 使用过一次后自动失效，需要重新生成。
 */
export function RecoverySection() {
  const { toast } = useToast();
  const [hasRecovery, setHasRecovery] = useState<boolean | null>(null);

  // 生成流程
  const [genOpen, setGenOpen] = useState(false);
  const [genPw, setGenPw] = useState('');
  const [generating, setGenerating] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);

  // 撤销流程
  const [revokeOpen, setRevokeOpen] = useState(false);
  const [revokePw, setRevokePw] = useState('');
  const [revoking, setRevoking] = useState(false);

  const loadStatus = useCallback(async () => {
    try {
      const res = await api<{ has_recovery: boolean }>('/api/vault');
      setHasRecovery(res.has_recovery);
    } catch {
      setHasRecovery(null);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  async function generate() {
    if (!genPw) {
      toast('请输入登录密码', 'error');
      return;
    }
    setGenerating(true);
    try {
      const res = await api<{ recovery_code: string }>('/api/vault/recovery', {
        method: 'POST',
        body: JSON.stringify({ password: genPw }),
      });
      setCode(res.recovery_code);
      setHasRecovery(true);
      setGenPw('');
      setGenOpen(false);
      setCopied(false);
      setSaved(false);
    } catch (err) {
      toast(err instanceof Error ? err.message : '生成失败', 'error');
    } finally {
      setGenerating(false);
    }
  }

  async function copyCode() {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast('恢复码已复制', 'success');
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast('复制失败，请手动选中文本', 'error');
    }
  }

  function downloadCode() {
    if (!code) return;
    const text = [
      'Evermemo 账号恢复码',
      '',
      `恢复码：${code}`,
      '',
      '使用方式：',
      '1. 打开 Evermemo 登录页，点击「忘记密码？」；',
      '2. 填写邮箱、这串恢复码，并设置新密码；',
      '3. 成功后即可继续阅读所有记忆胶囊（恢复码随即失效，可重新生成）。',
      '',
      '请妥善保管，不要截图分享给他人。',
      `生成时间：${new Date().toLocaleString('zh-CN')}`,
    ].join('\n');
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'evermemo-恢复码.txt';
    a.click();
    URL.revokeObjectURL(url);
    toast('已下载恢复码文件', 'success');
  }

  async function revoke() {
    if (!revokePw) {
      toast('请输入登录密码', 'error');
      return;
    }
    setRevoking(true);
    try {
      await api('/api/vault/recovery', {
        method: 'DELETE',
        body: JSON.stringify({ password: revokePw }),
      });
      setHasRecovery(false);
      setRevokePw('');
      setRevokeOpen(false);
      toast('恢复码已撤销', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : '撤销失败', 'error');
    } finally {
      setRevoking(false);
    }
  }

  return (
    <section className="card p-5 sm:p-6" id="recovery">
      <h2 className="mb-1 flex items-center gap-2 text-[16px] font-semibold">
        <KeyRound size={17} className="text-accent" />
        恢复码
      </h2>
      <p className="mb-4 text-[12.5px] leading-relaxed text-muted">
        记忆胶囊的正文由你的登录口令派生加密。如果有一天忘记口令，恢复码可以帮你找回账号并重设口令，
        已加密封存的信不会丢失。
      </p>

      <div className="mb-4 flex items-center gap-2 text-[13px]">
        <span className={`h-2 w-2 rounded-full ${hasRecovery ? 'bg-accent' : 'bg-border'}`} />
        <span className="text-muted">
          {hasRecovery === null ? '正在读取状态…' : hasRecovery ? '已设置恢复码' : '尚未设置恢复码'}
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => setGenOpen(true)}>
          <KeyRound size={15} />
          {hasRecovery ? '重新生成' : '生成恢复码'}
        </Button>
        {hasRecovery && (
          <Button variant="ghost" onClick={() => setRevokeOpen(true)}>
            <ShieldOff size={15} />
            撤销恢复码
          </Button>
        )}
      </div>
      <p className="mt-3 text-[12px] leading-relaxed text-muted">
        恢复码只显示一次、只可使用一次。忘记口令且没有恢复码时，加密的胶囊正文将无法恢复。
      </p>

      {/* 生成：输入登录口令 */}
      <Dialog open={genOpen} onClose={() => setGenOpen(false)} title="生成恢复码">
        <p className="mb-4 text-[13px] leading-relaxed text-muted">
          为了确认是你本人，请输入当前登录密码。验证通过后会生成一串恢复码，只显示这一次。
        </p>
        <Label>登录密码</Label>
        <Input
          type="password"
          value={genPw}
          onChange={(e) => setGenPw(e.target.value)}
          autoComplete="current-password"
          onKeyDown={(e) => {
            if (e.key === 'Enter') void generate();
          }}
        />
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setGenOpen(false)}>
            取消
          </Button>
          <Button onClick={() => void generate()} loading={generating}>
            生成
          </Button>
        </div>
      </Dialog>

      {/* 一次性展示恢复码 */}
      <Dialog
        open={code !== null}
        onClose={() => {
          if (!saved) {
            toast('建议先复制或下载，再关闭', 'info');
            return;
          }
          setCode(null);
        }}
        title="你的恢复码（只显示这一次）"
      >
        <div className="rounded-xl border border-border bg-foreground/[0.03] px-4 py-3">
          <div className="break-all font-mono text-[15px] leading-relaxed tracking-wide">{code}</div>
        </div>
        <p className="mt-3 text-[12.5px] leading-relaxed text-muted">
          请复制或下载后妥善保存。关闭后无法再次查看；它相当于备份钥匙，不要发给别人。
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => void copyCode()}>
            {copied ? <Check size={15} /> : <Copy size={15} />}
            {copied ? '已复制' : '复制'}
          </Button>
          <Button variant="secondary" onClick={downloadCode}>
            <Download size={15} />
            下载 .txt
          </Button>
        </div>
        <label className="mt-4 flex cursor-pointer items-center gap-2 text-[13px] text-muted">
          <input
            type="checkbox"
            checked={saved}
            onChange={(e) => setSaved(e.target.checked)}
            className="h-4 w-4 accent-[var(--accent)]"
          />
          我已经保存好了
        </label>
        <div className="mt-4 flex justify-end">
          <Button
            disabled={!saved}
            onClick={() => {
              setCode(null);
              toast('恢复码已生成，请保管好备份', 'success');
            }}
          >
            完成
          </Button>
        </div>
      </Dialog>

      {/* 撤销：输入登录口令 */}
      <Dialog open={revokeOpen} onClose={() => setRevokeOpen(false)} title="撤销恢复码">
        <p className="mb-4 text-[13px] leading-relaxed text-muted">
          撤销后，忘记口令时将无法通过恢复码找回加密的胶囊正文。请输入登录密码确认。
        </p>
        <Label>登录密码</Label>
        <Input
          type="password"
          value={revokePw}
          onChange={(e) => setRevokePw(e.target.value)}
          autoComplete="current-password"
          onKeyDown={(e) => {
            if (e.key === 'Enter') void revoke();
          }}
        />
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setRevokeOpen(false)}>
            取消
          </Button>
          <Button variant="danger" onClick={() => void revoke()} loading={revoking}>
            撤销
          </Button>
        </div>
      </Dialog>
    </section>
  );
}
