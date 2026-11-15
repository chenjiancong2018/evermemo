'use client';

import { useRef, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface TagInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  suggestions?: string[];
  placeholder?: string;
}

/** 标签芯片输入：回车/逗号添加，点击 × 删除 */
export function TagInput({ value, onChange, suggestions = [], placeholder = '输入标签后回车' }: TagInputProps) {
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  function addTag(raw: string) {
    const name = raw.trim().replace(/[，,]$/, '');
    if (!name) return;
    if (value.includes(name)) {
      setText('');
      return;
    }
    onChange([...value, name].slice(0, 20));
    setText('');
  }

  function removeTag(name: string) {
    onChange(value.filter((t) => t !== name));
  }

  const remaining = suggestions.filter((s) => !value.includes(s)).slice(0, 6);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5">
        {value.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-lg bg-accent-soft px-2.5 py-1 text-[12.5px] text-accent"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="text-accent/60 hover:text-accent"
              aria-label={`删除标签 ${tag}`}
            >
              <X size={12} />
            </button>
          </span>
        ))}
        <div className="min-w-[120px] flex-1">
          <Input
            ref={inputRef}
            value={text}
            onChange={(e) => {
              if (e.target.value.endsWith(',') || e.target.value.endsWith('，')) {
                addTag(e.target.value);
              } else {
                setText(e.target.value);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault();
                addTag(text);
              } else if (e.key === 'Backspace' && !text && value.length > 0) {
                removeTag(value[value.length - 1]);
              }
            }}
            onBlur={() => {
              if (text.trim()) addTag(text);
            }}
            placeholder={value.length === 0 ? placeholder : ''}
            className="!border-0 !bg-transparent !px-1 !py-1.5 !text-[13.5px] !shadow-none !ring-0"
          />
        </div>
      </div>
      {remaining.length > 0 && value.length === 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {remaining.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => addTag(s)}
              className="inline-flex items-center gap-0.5 rounded-lg border border-border px-2 py-0.5 text-[12px] text-muted hover:border-accent hover:text-accent"
            >
              <Plus size={11} />
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
