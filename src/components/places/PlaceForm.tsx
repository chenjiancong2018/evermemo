'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api/client';
import type { PlaceRow } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input, Label, Textarea } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { CoverPicker } from '@/components/archive/CoverPicker';

export interface PlaceFormProps {
  place?: PlaceRow;
  onSaved?: () => void;
  onCancel?: () => void;
  standalone?: boolean;
}

export function PlaceForm({ place, onSaved, onCancel, standalone = false }: PlaceFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState(place?.name ?? '');
  const [country, setCountry] = useState(place?.country ?? '');
  const [city, setCity] = useState(place?.city ?? '');
  const [address, setAddress] = useState(place?.address ?? '');
  const [description, setDescription] = useState(place?.description ?? '');
  const [coverMediaId, setCoverMediaId] = useState<string | null>(place?.cover_path ?? null);

  async function submit() {
    if (submitting) return;
    if (!name.trim()) {
      toast('请输入地点名称', 'error');
      return;
    }
    setSubmitting(true);
    const payload = {
      name,
      country: country || null,
      city: city || null,
      address: address || null,
      description: description || null,
      cover_media_id: coverMediaId,
    };
    try {
      const saved = await api<PlaceRow>(place ? `/api/places/${place.id}` : '/api/places', {
        method: place ? 'PATCH' : 'POST',
        body: JSON.stringify(payload),
      });
      toast(place ? '已保存修改' : '已创建地点档案', 'success');
      if (standalone) {
        router.push(`/places/${saved.id}`);
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
        <Label className="mb-1.5 block text-[12.5px] text-muted">地点名称</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="如：杭州西湖、老家的院子" maxLength={200} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label className="mb-1.5 block text-[12.5px] text-muted">国家/地区（可选）</Label>
          <Input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="中国" maxLength={100} />
        </div>
        <div>
          <Label className="mb-1.5 block text-[12.5px] text-muted">城市（可选）</Label>
          <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="杭州" maxLength={100} />
        </div>
      </div>
      <div>
        <Label className="mb-1.5 block text-[12.5px] text-muted">详细地址（可选）</Label>
        <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="街道、门牌等" maxLength={300} />
      </div>
      <div>
        <Label className="mb-1.5 block text-[12.5px] text-muted">描述</Label>
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} placeholder="关于这个地方…" />
      </div>
      <div>
        <Label className="mb-1.5 block text-[12.5px] text-muted">封面</Label>
        <CoverPicker mediaId={coverMediaId} onChange={(id) => setCoverMediaId(id)} />
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
