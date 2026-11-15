import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';

/**
 * V2.0 AI 功能层集成测试（临时 SQLite + AI_MOCK=1 模拟模式）。
 * 必须在动态 import 前设置 env。
 */
const tmp = mkdtempSync(join(tmpdir(), 'evermemo-v20-'));
process.env.DATABASE_PATH = join(tmp, 'test.db');
process.env.DATA_DIR = tmp;
process.env.UPLOADS_DIR = join(tmp, 'uploads');
process.env.AI_MOCK = '1';

let db: typeof import('@/lib/db');
let entriesDb: typeof import('@/lib/db/entries');
let features: typeof import('@/lib/ai/features');
let semantic: typeof import('@/lib/ai/semantic');

const USER_A = randomUUID();
const USER_B = randomUUID();

beforeAll(async () => {
  db = await import('@/lib/db');
  entriesDb = await import('@/lib/db/entries');
  features = await import('@/lib/ai/features');
  semantic = await import('@/lib/ai/semantic');
  const now = new Date().toISOString();
  const ins = db.getDb().prepare(
    `INSERT INTO users (id, email, password_hash, display_name, created_at, updated_at) VALUES (?, ?, 'x', ?, ?, ?)`
  );
  ins.run(USER_A, 'ai-a@test.local', '甲', now, now);
  ins.run(USER_B, 'ai-b@test.local', '乙', now, now);
});

afterAll(() => db.closeDb());

function mkEntry(over: Partial<import('@/lib/db/entries').EntryInput> & { occurred_at: string }) {
  const base: import('@/lib/db/entries').EntryInput = {
    title: over.title ?? '',
    content: '',
    entry_type: 'diary',
    occurred_at: over.occurred_at,
    mood: null,
    tags: [],
    media_ids: [],
    people_ids: [],
    places_ids: [],
    is_favorite: false,
    is_important: false,
    is_archived: false,
  };
  return entriesDb.createEntry(USER_A, { ...base, ...over });
}

describe('from/to 日期区间查询', () => {
  it('按闭区间过滤', () => {
    mkEntry({ title: '一月', occurred_at: '2026-01-15T10:00:00' });
    mkEntry({ title: '六月', occurred_at: '2026-06-15T10:00:00' });
    mkEntry({ title: '十二月', occurred_at: '2026-12-15T10:00:00' });
    const r = entriesDb.listEntries(USER_A, { page: 1, page_size: 50, from: '2026-02-01', to: '2026-11-30' });
    expect(r.total).toBe(1);
    expect(r.items[0].title).toBe('六月');
    const r2 = entriesDb.listEntries(USER_A, { page: 1, page_size: 50, to: '2026-01-31' });
    expect(r2.total).toBe(1);
    expect(r2.items[0].title).toBe('一月');
  });
});

describe('AI 整理（mock）', () => {
  it('返回带 mock 标记的建议结构', async () => {
    const r = await features.organizeEntry(USER_A, '今天去了海边，很开心');
    expect(r.mock).toBe(true);
    expect(r.title).toBeTruthy();
    expect(r.tags.length).toBeGreaterThan(0);
    expect(r.entry_type).toBe('moment');
    expect(r.polished).toContain('海边');
  });
});

describe('AI 回顾（mock）', () => {
  it('无记录时不调 AI，如实说明', async () => {
    const r = await features.reviewRange(USER_A, { start: '2000-01-01', end: '2000-12-31', label: '2000 年' });
    expect(r.entryCount).toBe(0);
    expect(r.draft).toBe('');
    expect(r.sources).toEqual([]);
  });

  it('有记录时返回 [MOCK] 标记的草稿与来源', async () => {
    const r = await features.reviewRange(USER_A, { start: '2026-01-01', end: '2026-12-31', label: '2026 年' });
    expect(r.entryCount).toBe(3);
    expect(r.mock).toBe(true);
    expect(r.draft).toContain('[MOCK]');
    expect(r.sources.length).toBe(3);
  });
});

describe('AI 问答（mock）', () => {
  it('无记录时如实回答，不编造', async () => {
    const r = await features.askQuestion(USER_B, '我最喜欢吃什么？', []);
    expect(r.citations).toEqual([]);
    expect(r.answer).toContain('还没有记录');
  });

  it('有记录时带引用与 [MOCK] 标记', async () => {
    const r = await features.askQuestion(USER_A, '我六月做了什么？', []);
    expect(r.mock).toBe(true);
    expect(r.answer).toContain('[MOCK]');
    expect(r.citations.length).toBeGreaterThan(0);
    expect(r.citations[0].id).toBeTruthy();
  });
});

describe('AI 年度回顾（mock）', () => {
  it('无记录年份返回 entryCount 0', async () => {
    const r = await features.yearlyReview(USER_A, 1999);
    expect(r.entryCount).toBe(0);
    expect(r.story).toBe('');
  });

  it('有记录年份返回结构', async () => {
    const r = await features.yearlyReview(USER_A, 2026);
    expect(r.entryCount).toBe(3);
    expect(r.mock).toBe(true);
    expect(r.keywords.length).toBeGreaterThan(0);
    expect(r.story).toContain('[MOCK]');
  });
});

describe('AI 故事整理（mock）', () => {
  it('按 id 保序取记录并返回草稿', async () => {
    const all = entriesDb.listEntries(USER_A, { page: 1, page_size: 50 });
    const ids = all.items.map((e) => e.id).slice(0, 2);
    const r = await features.storyDraft(USER_A, ids);
    expect(r.entryCount).toBe(2);
    expect(r.mock).toBe(true);
    expect(r.sources).toEqual(ids);
    expect(r.draft).toContain('[MOCK]');
  });

  it('id 不属于该用户时忽略', async () => {
    const r = await features.storyDraft(USER_A, [randomUUID()]);
    expect(r.entryCount).toBe(0);
  });
});

describe('语义搜索（mock）', () => {
  it('无记录时如实说明', async () => {
    const r = await semantic.semanticSearch(USER_B, '海边');
    expect(r.hits).toEqual([]);
    expect(r.note).toBeTruthy();
  });

  it('mock 模式按关键词重合打分', async () => {
    const r = await semantic.semanticSearch(USER_A, '六月');
    expect(r.mode).toBe('mock');
    expect(r.hits.length).toBeGreaterThan(0);
    expect(r.hits[0].entry.title).toBe('六月');
  });
});
