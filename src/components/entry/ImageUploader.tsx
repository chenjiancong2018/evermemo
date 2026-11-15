'use client';

import { useRef, useState } from 'react';
import { ImagePlus, Loader2, RotateCcw, X } from 'lucide-react';
import type { MediaRow } from '@/lib/types';
import { useToast } from '@/components/ui/toast';

interface UploadTask {
  id: string;
  fileName: string;
  progress: number;
  status: 'uploading' | 'done' | 'error';
  media?: MediaRow;
  error?: string;
}

interface ImageUploaderProps {
  media: MediaRow[];
  onChange: (media: MediaRow[]) => void;
  maxCount?: number;
}

/** 图片上传：批量、进度、失败重试（上限校验在服务端） */
export function ImageUploader({ media, onChange, maxCount = 50 }: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [tasks, setTasks] = useState<UploadTask[]>([]);
  const { toast } = useToast();

  function pickFiles() {
    inputRef.current?.click();
  }

  function uploadFile(file: File) {
    const taskId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const task: UploadTask = { id: taskId, fileName: file.name, progress: 0, status: 'uploading' };
    setTasks((prev) => [...prev, task]);

    const xhr = new XMLHttpRequest();
    const form = new FormData();
    form.append('file', file);
    xhr.open('POST', '/api/media/upload');
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const progress = Math.round((e.loaded / e.total) * 100);
        setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, progress } : t)));
      }
    };
    xhr.onload = () => {
      try {
        const env = JSON.parse(xhr.responseText);
        if (env.ok && env.data?.items?.length) {
          const row = env.data.items[0] as MediaRow;
          setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: 'done', media: row } : t)));
          onChange([...media, row]);
        } else {
          throw new Error(env.error?.message ?? '上传失败');
        }
      } catch (err) {
        setTasks((prev) =>
          prev.map((t) =>
            t.id === taskId
              ? { ...t, status: 'error', error: err instanceof Error ? err.message : '上传失败' }
              : t
          )
        );
      }
    };
    xhr.onerror = () => {
      setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: 'error', error: '网络错误' } : t)));
    };
    xhr.send(form);
  }

  function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length === 0) return;
    if (media.length + files.length > maxCount) {
      toast(`一条记录最多 ${maxCount} 张图片`, 'error');
      return;
    }
    const invalid = files.find((f) => !/^image\/(jpeg|png|webp)$/.test(f.type) && !/\.(jpe?g|png|webp)$/i.test(f.name));
    if (invalid) {
      toast(`「${invalid.name}」不是支持的图片格式`, 'error');
      return;
    }
    files.forEach(uploadFile);
  }

  function retry(fileName: string) {
    setTasks((prev) => prev.filter((t) => !(t.fileName === fileName && t.status === 'error')));
    // 重新选择同一文件：从已选任务里找不到原 File 对象，需要重新挑选
    toast('请重新选择图片文件');
    inputRef.current?.click();
  }

  function remove(mediaId: string) {
    onChange(media.filter((m) => m.id !== mediaId));
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={onFiles}
      />

      <div className="flex flex-wrap gap-2">
        {media.map((m) => (
          <div key={m.id} className="group relative h-20 w-20 overflow-hidden rounded-xl bg-accent-soft">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/media/${m.id}/thumb`} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => remove(m.id)}
              className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-[10px] text-white hover:bg-danger"
              aria-label="移除"
            >
              <X size={11} />
            </button>
          </div>
        ))}

        {media.length < maxCount && (
          <button
            type="button"
            onClick={pickFiles}
            className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-border text-muted transition-colors hover:border-accent hover:text-accent"
          >
            <ImagePlus size={20} />
            <span className="text-[11px]">添加图片</span>
          </button>
        )}
      </div>

      {tasks.filter((t) => t.status !== 'done').map((t) => (
        <div key={t.id} className="mt-2 flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-[12.5px]">
          {t.status === 'uploading' ? (
            <>
              <Loader2 size={14} className="shrink-0 animate-spin text-accent" />
              <span className="min-w-0 flex-1 truncate text-muted">{t.fileName}</span>
              <div className="h-1.5 w-16 overflow-hidden rounded-full bg-accent-soft">
                <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${t.progress}%` }} />
              </div>
              <span className="w-8 text-right text-muted">{t.progress}%</span>
            </>
          ) : (
            <>
              <span className="min-w-0 flex-1 truncate text-danger">「{t.fileName}」{t.error ?? '上传失败'}</span>
              <button
                type="button"
                onClick={() => retry(t.fileName)}
                className="inline-flex items-center gap-1 text-accent hover:underline"
              >
                <RotateCcw size={12} />
                重试
              </button>
            </>
          )}
        </div>
      ))}
    </div>
  );
}
