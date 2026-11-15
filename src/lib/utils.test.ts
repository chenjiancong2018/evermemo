import { describe, expect, it } from 'vitest';
import {
  cn,
  excerpt,
  formatDate,
  formatDateCN,
  formatDateTime,
  groupKey,
  groupTitle,
  yearsAgo,
} from './utils';

describe('cn', () => {
  it('过滤空值并拼接', () => {
    expect(cn('a', false, null, undefined, 'b')).toBe('a b');
  });
});

describe('formatDate / formatDateTime / formatDateCN', () => {
  it('formatDate 取日期部分', () => {
    expect(formatDate('2026-11-08T17:31:00')).toBe('2026-11-08');
  });
  it('formatDateTime 无时间部分时原样返回', () => {
    expect(formatDateTime('2026-11-08')).toBe('2026-11-08');
  });
  it('formatDateTime 有时间部分时转空格分隔', () => {
    expect(formatDateTime('2026-11-08T17:31')).toBe('2026-11-08 17:31');
  });
  it('formatDateCN 中文日期', () => {
    expect(formatDateCN('2026-11-08')).toBe('2026年11月8日');
  });
});

describe('groupKey / groupTitle', () => {
  const at = '2026-11-08T09:00:00';
  it('按日分组', () => {
    expect(groupKey(at, 'day')).toBe('2026-11-08');
    expect(groupTitle('2026-11-08', 'day')).toBe('2026年11月8日');
  });
  it('按月分组', () => {
    expect(groupKey(at, 'month')).toBe('2026-11');
    expect(groupTitle('2026-11', 'month')).toBe('2026年11月');
  });
  it('按年分组', () => {
    expect(groupKey(at, 'year')).toBe('2026');
    expect(groupTitle('2026', 'year')).toBe('2026年');
  });
});

describe('yearsAgo', () => {
  const now = new Date('2026-11-08T12:00:00');
  it('今年为 0', () => {
    expect(yearsAgo('2026-01-01', now)).toBe(0);
  });
  it('去年今天之后为 0，之前为 1', () => {
    expect(yearsAgo('2025-12-31', now)).toBe(0);
    expect(yearsAgo('2025-11-07', now)).toBe(1);
  });
  it('跨多年', () => {
    expect(yearsAgo('2020-11-08', now)).toBe(6);
  });
});

describe('excerpt', () => {
  it('剥离 Markdown 语法', () => {
    const md = '# 标题\n\n这是一段 **加粗** 文字，[链接](https://example.com) 与 ![图](x.jpg)。';
    const out = excerpt(md);
    expect(out).toContain('这是一段 加粗 文字，链接 与 。');
    expect(out).not.toContain('#');
    expect(out).not.toContain('**');
  });
  it('超长截断加省略号', () => {
    expect(excerpt('x'.repeat(200), 50)).toBe('x'.repeat(50) + '…');
  });
});
