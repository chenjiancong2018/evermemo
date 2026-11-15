/** 合并 className（最小实现，避免额外依赖） */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/** YYYY-MM-DD */
export function formatDate(iso: string): string {
  if (!iso) return '';
  return iso.slice(0, 10);
}

/** YYYY-MM-DD HH:mm（当时间部分存在时） */
export function formatDateTime(iso: string): string {
  if (!iso) return '';
  if (iso.length <= 10) return iso;
  return iso.slice(0, 16).replace('T', ' ');
}

/** 中文日期：2026年11月8日 */
export function formatDateCN(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${y}年${Number(m)}月${Number(d)}日`;
}

/** 相对“今天”的差距描述 */
export function yearsAgo(occurredAt: string, now: Date = new Date()): number {
  const year = Number(occurredAt.slice(0, 4));
  const nowYear = now.getFullYear();
  const md = occurredAt.slice(5, 10);
  const nowMd = `${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
  let diff = nowYear - year;
  if (md > nowMd) diff -= 1;
  return diff;
}

/** 按视图粒度取分组键：day=YYYY-MM-DD，month=YYYY-MM，year=YYYY */
export function groupKey(occurredAt: string, view: 'day' | 'month' | 'year'): string {
  if (view === 'year') return occurredAt.slice(0, 4);
  if (view === 'month') return occurredAt.slice(0, 7);
  return occurredAt.slice(0, 10);
}

/** 分组标题 */
export function groupTitle(key: string, view: 'day' | 'month' | 'year'): string {
  if (view === 'year') return `${key}年`;
  if (view === 'month') {
    const [y, m] = key.split('-');
    return `${y}年${Number(m)}月`;
  }
  const [y, m, d] = key.split('-');
  return `${y}年${Number(m)}月${Number(d)}日`;
}

/** 截取纯文本摘要 */
export function excerpt(markdown: string, max = 120): string {
  const text = markdown
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '') // 图片
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // 链接
    .replace(/[#>*_`~\-]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > max ? text.slice(0, max) + '…' : text;
}
