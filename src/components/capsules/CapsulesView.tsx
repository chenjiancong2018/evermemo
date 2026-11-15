'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Clock3, KeyRound, Lock, LockOpen, Mail, Pencil, Plus, Trash2 } from 'lucide-react';
import { api } from '@/lib/api/client';
import { useToast } from '@/components/ui/toast';
import { Dialog } from '@/components/ui/dialog';
import { Input, Textarea } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { formatDateCN } from '@/lib/utils';
import type { MediaRow } from '@/lib/types';

interface CapsuleItem {
  id: string;
  title: string;
  content: string;
  open_at: string;
  opened_at: string | null;
  created_at: string;
  media: MediaRow[];
  openable: boolean;
  opened: boolean;
  /** 保险库未解锁时正文不可读 */
  locked?: boolean;
}

type Status = 'locked' | 'opened' | 'all';

export default function CapsulesView() {
  const { toast } = useToast();
  const [items, setItems] = useState<CapsuleItem[]>([]);
  const [status, setStatus] = useState<Status>('locked');
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CapsuleItem | null>(null);
  const [opening, setOpening] = useState<CapsuleItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [openAt, setOpenAt] = useState('');
  const [vaultUnlocked, setVaultUnlocked] = useState(true);
  const [unlockOpen, setUnlockOpen] = useState(false);
  const [unlockPw, setUnlockPw] = useState('');
  const [unlocking, setUnlocking] = useState(false);
  const reqSeq = useRef(0);

  const load = useCallback(async () => {
    const seq = ++reqSeq.current;
    setLoading(true);
    try {
      const data = await api<{ items: CapsuleItem[]; total: number }>(`/api/capsules?status=${status}&page_size=50`);
      if (seq !== reqSeq.current) return;
      setItems(data.items);
      if (data.items.some((c) => c.locked)) setVaultUnlocked(false);
    } catch (err) {
      if (seq !== reqSeq.current) return;
      toast(err instanceof Error ? err.message : '加载失败', 'error');
    } finally {
      if (seq === reqSeq.current) setLoading(false);
    }
  }, [status, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const unlock = async () => {
    if (!unlockPw) return toast('请输入登录密码', 'error');
    setUnlocking(true);
    try {
      await api('/api/vault', { method: 'POST', body: JSON.stringify({ password: unlockPw }) });
      setVaultUnlocked(true);
      setUnlockOpen(false);
      setUnlockPw('');
      toast('已解锁，开启的信件可以阅读了', 'success');
      void load();
    } catch (err) {
      toast(err instanceof Error ? err.message : '解锁失败', 'error');
    } finally {
      setUnlocking(false);
    }
  };

  const openForm = (capsule?: CapsuleItem) => {
    setEditing(capsule ?? null);
    setTitle(capsule?.title ?? '');
    setContent(capsule?.content ?? '');
    setOpenAt(capsule?.open_at ?? '');
    setFormOpen(true);
  };

  const submit = async () => {
    if (!title.trim()) return toast('请写下标题', 'error');
    if (!content.trim()) return toast('请写下想说的话', 'error');
    if (!openAt) return toast('请选择开启日期', 'error');
    setSaving(true);
    try {
      if (editing) {
        await api(`/api/capsules/${editing.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ title, content, open_at: openAt }),
        });
        toast('信封已更新', 'success');
      } else {
        await api('/api/capsules', {
          method: 'POST',
          body: JSON.stringify({ title, content, open_at: openAt }),
        });
        toast('胶囊已封存，等待开启的那一天', 'success');
      }
      setFormOpen(false);
      void load();
    } catch (err) {
      toast(err instanceof Error ? err.message : '保存失败', 'error');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (capsule: CapsuleItem) => {
    if (!window.confirm(`确定删除「${capsule.title}」吗？此操作不可恢复。`)) return;
    try {
      await api(`/api/capsules/${capsule.id}`, { method: 'DELETE' });
      toast('已删除', 'success');
      void load();
    } catch (err) {
      toast(err instanceof Error ? err.message : '删除失败', 'error');
    }
  };

  const today = new Date().toISOString().slice(0, 10);
  const openable = (c: CapsuleItem) => c.open_at <= today;
  const needsUnlock = !vaultUnlocked || items.some((c) => c.locked);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-1.5">
          {(
            [
              ['locked', '待开启'],
              ['opened', '已开启'],
              ['all', '全部'],
            ] as [Status, string][]
          ).map(([v, label]) => (
            <button
              key={v}
              onClick={() => setStatus(v)}
              className={`rounded-full px-3 py-1 text-xs transition-colors ${
                status === v ? 'bg-accent text-white' : 'border border-border text-muted hover:border-accent hover:text-accent'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {needsUnlock && (
            <Button variant="secondary" onClick={() => setUnlockOpen(true)}>
              <LockOpen size={14} /> 解锁胶囊
            </Button>
          )}
          <Button onClick={() => openForm()}>
            <Plus size={14} /> 封存一封信
          </Button>
        </div>
      </div>

      {needsUnlock && (
        <div className="flex items-start gap-3 rounded-xl border border-border bg-accent-soft/30 p-3 text-xs text-muted">
          <Lock size={14} className="mt-0.5 shrink-0 text-accent" />
          <p>
            记忆胶囊已加密锁定：胶囊正文的密钥由你的登录口令派生，只有输入口令解锁后才能阅读。
            关闭浏览器或退出登录后会自动重新锁定。
          </p>
        </div>
      )}

      {loading ? (
        <div className="card py-12 text-center text-sm text-muted">加载中…</div>
      ) : items.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 py-12 text-center">
          <Mail size={28} className="text-accent" />
          <p className="text-sm text-muted">
            {status === 'locked' ? '还没有待开启的信。写一封信给未来的自己吧。' : '这里空空如也。'}
          </p>
          <Button variant="secondary" onClick={() => openForm()}>
            写下第一封信
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((c) => {
            const canOpen = openable(c);
            return (
              <div key={c.id} className={`card flex flex-col ${canOpen ? '' : 'opacity-90'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    {canOpen ? (
                      <Mail size={15} className="shrink-0 text-accent" />
                    ) : (
                      <Lock size={15} className="shrink-0 text-muted" />
                    )}
                    <h3 className="truncate text-sm font-medium">{c.title}</h3>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    {!canOpen && (
                      <button
                        onClick={() => openForm(c)}
                        className="rounded p-1 text-muted hover:bg-accent-soft hover:text-accent"
                        aria-label="编辑"
                        title="编辑（未开启前可修改）"
                      >
                        <Pencil size={13} />
                      </button>
                    )}
                    <button
                      onClick={() => void remove(c)}
                      className="rounded p-1 text-muted hover:bg-danger/10 hover:text-danger"
                      aria-label="删除"
                      title="删除"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-1.5 text-xs text-muted">
                  <Clock3 size={12} />
                  {canOpen ? (
                    c.opened ? (
                      <>已于 {formatDateCN(c.opened_at!.slice(0, 10))} 开启</>
                    ) : (
                      <>已到开启日期，等待打开</>
                    )
                  ) : (
                    <>{formatDateCN(c.open_at)} 开启</>
                  )}
                </div>
                {c.media.length > 0 && (
                  <p className="mt-2 text-xs text-muted">附 {c.media.length} 张照片</p>
                )}
                <div className="mt-auto flex gap-2 pt-3">
                  {canOpen && (
                    <Button
                      className="flex-1"
                      variant="primary"
                      onClick={() => {
                        if (c.locked) setUnlockOpen(true);
                        else setOpening(c);
                      }}
                    >
                      {c.locked ? (
                        <>
                          <KeyRound size={13} /> 解锁后阅读
                        </>
                      ) : (
                        '打开信封'
                      )}
                    </Button>
                  )}
                  {!canOpen && (
                    <p className="flex-1 text-xs text-muted">
                      还有{' '}
                      {Math.max(
                        1,
                        Math.ceil((new Date(c.open_at + 'T00:00:00').getTime() - new Date(today + 'T00:00:00').getTime()) / 86400000)
                      )}{' '}
                      天
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 新建/编辑 */}
      <Dialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? '修改这封信' : '写给未来的一封信'}
        wide
      >
        <div className="flex flex-col gap-3">
          <div>
            <Input
              placeholder="给这封信起个标题"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={100}
            />
          </div>
          <div>
            <Textarea
              rows={6}
              placeholder={'写下想对未来的自己说的话…\n\n多年后打开，会是什么心情？'}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              maxLength={20000}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">开启日期（那天才能打开）</label>
            <Input type="date" value={openAt} onChange={(e) => setOpenAt(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={() => setFormOpen(false)}>
              取消
            </Button>
            <Button onClick={() => void submit()} loading={saving}>
              {editing ? '保存修改' : '封存'}
            </Button>
          </div>
        </div>
      </Dialog>

      {/* 解锁保险库 */}
      <Dialog open={unlockOpen} onClose={() => setUnlockOpen(false)} title="解锁记忆胶囊">
        <div className="flex flex-col gap-3">
          <p className="text-xs text-muted">
            输入登录密码，解开胶囊密钥。解锁状态保留 12 小时，退出登录或关闭服务器后自动重新锁定。
          </p>
          <Input
            type="password"
            placeholder="登录密码"
            value={unlockPw}
            onChange={(e) => setUnlockPw(e.target.value)}
            autoComplete="current-password"
            onKeyDown={(e) => {
              if (e.key === 'Enter') void unlock();
            }}
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setUnlockOpen(false)}>
              取消
            </Button>
            <Button onClick={() => void unlock()} loading={unlocking}>
              解锁
            </Button>
          </div>
        </div>
      </Dialog>

      {/* 开启 */}
      <Dialog open={!!opening} onClose={() => setOpening(null)} title={opening?.title ?? ''} wide>
        {opening && (
          <div className="flex flex-col gap-4">
            <p className="text-xs text-muted">
              {formatDateCN(opening.open_at)} 封存 · {opening.opened_at ? formatDateCN(opening.opened_at.slice(0, 10)) + ' 已开启' : '此刻开启'}
            </p>
            <div className="whitespace-pre-wrap rounded-xl bg-accent-soft/40 p-4 text-sm leading-relaxed">{opening.content}</div>
            {opening.media.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {opening.media.map((m) => (
                  <img
                    key={m.id}
                    src={`/api/media/${m.id}/thumb`}
                    alt={m.caption || '胶囊照片'}
                    className="h-24 w-24 rounded-lg object-cover"
                  />
                ))}
              </div>
            )}
            <div className="flex justify-end">
              <Button onClick={() => setOpening(null)}>收好</Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
