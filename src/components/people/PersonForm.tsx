'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api/client';
import type { PersonRow } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input, Label, Textarea } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { CoverPicker } from '@/components/archive/CoverPicker';

export interface PersonFormProps {
  person?: PersonRow;
  onSaved?: () => void;
  onCancel?: () => void;
  /** 独立编辑页模式：保存后跳回详情页 */
  standalone?: boolean;
}

export function PersonForm({ person, onSaved, onCancel, standalone = false }: PersonFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState(person?.name ?? '');
  const [nickname, setNickname] = useState(person?.nickname ?? '');
  const [relationship, setRelationship] = useState(person?.relationship_type ?? '');
  const [firstMet, setFirstMet] = useState(person?.first_met_at ?? '');
  const [description, setDescription] = useState(person?.description ?? '');
  const [notes, setNotes] = useState(person?.notes ?? '');
  const [avatarMediaId, setAvatarMediaId] = useState<string | null>(person?.avatar_path ?? null);

  async function submit() {
    if (submitting) return;
    if (!name.trim()) {
      toast('请输入姓名', 'error');
      return;
    }
    setSubmitting(true);
    const payload = {
      name,
      nickname: nickname || null,
      relationship_type: relationship || null,
      first_met_at: firstMet || null,
      description: description || null,
      notes: notes || null,
      avatar_media_id: avatarMediaId,
    };
    try {
      const saved = await api<PersonRow>(person ? `/api/people/${person.id}` : '/api/people', {
        method: person ? 'PATCH' : 'POST',
        body: JSON.stringify(payload),
      });
      toast(person ? '已保存修改' : '已创建人物档案', 'success');
      if (standalone) {
        router.push(`/people/${saved.id}`);
        router.refresh();
      } else {
        onSaved?.();
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : '保存失败', 'error');
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <Label className="mb-1.5 block text-[12.5px] text-muted">头像</Label>
        <CoverPicker mediaId={avatarMediaId} onChange={(id) => setAvatarMediaId(id)} round />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label className="mb-1.5 block text-[12.5px] text-muted">姓名</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="姓名或昵称" maxLength={100} />
        </div>
        <div>
          <Label className="mb-1.5 block text-[12.5px] text-muted">昵称（可选）</Label>
          <Input value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="怎么称呼" maxLength={100} />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label className="mb-1.5 block text-[12.5px] text-muted">关系（可选，由你自己定义）</Label>
          <Input value={relationship} onChange={(e) => setRelationship(e.target.value)} placeholder="如：大学同学、同事…" maxLength={60} />
        </div>
        <div>
          <Label className="mb-1.5 block text-[12.5px] text-muted">第一次出现（可选）</Label>
          <Input type="date" value={firstMet} onChange={(e) => setFirstMet(e.target.value)} aria-label="第一次出现日期" />
        </div>
      </div>
      <div>
        <Label className="mb-1.5 block text-[12.5px] text-muted">简介</Label>
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="TA 是谁…" />
      </div>
      <div>
        <Label className="mb-1.5 block text-[12.5px] text-muted">备注（仅自己可见）</Label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="想记住的细节…" />
      </div>
      <div className="flex justify-end gap-2 pt-1">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            取消
          </Button>
        )}
        <Button type="button" onClick={submit} loading={submitting}>
          保存
        </Button>
      </div>
    </div>
  );
}
