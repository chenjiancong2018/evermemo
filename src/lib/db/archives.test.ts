import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';

/**
 * V1.5 档案数据层集成测试（临时 SQLite 库，跑全部迁移）。
 * 注意：必须在动态 import 前设置 env，否则 config.ts 已按默认路径求值。
 */
const tmp = mkdtempSync(join(tmpdir(), 'evermemo-v15-'));
process.env.DATABASE_PATH = join(tmp, 'test.db');
process.env.DATA_DIR = tmp;
process.env.UPLOADS_DIR = join(tmp, 'uploads');

let db: typeof import('@/lib/db');
let peopleDb: typeof import('@/lib/db/people');
let placesDb: typeof import('@/lib/db/places');
let milestonesDb: typeof import('@/lib/db/milestones');
let chaptersDb: typeof import('@/lib/db/chapters');
let entriesDb: typeof import('@/lib/db/entries');

const USER_A = randomUUID();
const USER_B = randomUUID();

beforeAll(async () => {
  db = await import('@/lib/db');
  peopleDb = await import('@/lib/db/people');
  placesDb = await import('@/lib/db/places');
  milestonesDb = await import('@/lib/db/milestones');
  chaptersDb = await import('@/lib/db/chapters');
  entriesDb = await import('@/lib/db/entries');
  const now = new Date().toISOString();
  const ins = db.getDb().prepare(
    `INSERT INTO users (id, email, password_hash, display_name, created_at, updated_at) VALUES (?, ?, 'x', ?, ?, ?)`
  );
  ins.run(USER_A, 'a@test.local', '甲', now, now);
  ins.run(USER_B, 'b@test.local', '乙', now, now);
});

afterAll(() => db.closeDb());

/** EntryInput 全字段填充助手（db 层要求完整输入，缺省由 API schema 负责） */
function mkEntry(over: Partial<import('@/lib/db/entries').EntryInput> & { title: string; occurred_at: string }) {
  const base: import('@/lib/db/entries').EntryInput = {
    title: over.title,
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

describe('人物档案', () => {
  it('创建/查询/编辑/删除', () => {
    const p = peopleDb.createPerson(USER_A, { name: '妈妈', relationship_type: '家人' });
    expect(p.name).toBe('妈妈');
    expect(peopleDb.personWithMeta(p.id, USER_A)?.relationship_type).toBe('家人');
    expect(peopleDb.personWithMeta(p.id, USER_B)).toBeNull(); // 用户隔离

    const updated = peopleDb.updatePerson(USER_A, p.id, { nickname: '老妈' });
    expect(updated?.nickname).toBe('老妈');
    expect(peopleDb.updatePerson(USER_B, p.id, { nickname: 'x' })).toBeNull();

    expect(peopleDb.deletePerson(USER_A, p.id)).toBeNull(); // 无头像返回 null media
    expect(peopleDb.personWithMeta(p.id, USER_A)).toBeNull();
  });

  it('列表搜索按名称匹配', () => {
    peopleDb.createPerson(USER_A, { name: '张三' });
    peopleDb.createPerson(USER_A, { name: '李四' });
    const r = peopleDb.listPeople(USER_A, { page: 1, page_size: 10, q: '张三' });
    expect(r.total).toBe(1);
    expect(r.items[0].name).toBe('张三');
  });
});

describe('地点档案', () => {
  it('创建/查询/编辑/删除', () => {
    const pl = placesDb.createPlace(USER_A, { name: '洱海', city: '大理', latitude: 25.6, longitude: 100.2 });
    expect(placesDb.placeWithMeta(pl.id, USER_A)?.city).toBe('大理');
    expect(placesDb.placeWithMeta(pl.id, USER_B)).toBeNull();
    const updated = placesDb.updatePlace(USER_A, pl.id, { country: '中国' });
    expect(updated?.country).toBe('中国');
    placesDb.deletePlace(USER_A, pl.id);
    expect(placesDb.placeWithMeta(pl.id, USER_A)).toBeNull();
  });
});

describe('重要时刻', () => {
  it('创建+关联人物地点与记录，查询带元数据', () => {
    const p = peopleDb.createPerson(USER_A, { name: '爸爸' });
    const pl = placesDb.createPlace(USER_A, { name: '学校' });
    const e = mkEntry({ title: '毕业那天', occurred_at: '2020-06-20', entry_type: 'event' });
    const m = milestonesDb.createMilestone(USER_A, {
      title: '大学毕业',
      occurred_at: '2020-06-20',
      importance: 3,
      entry_ids: [e.id],
      person_ids: [p.id],
      place_ids: [pl.id],
    });
    const meta = milestonesDb.milestoneWithMeta(m.id, USER_A);
    expect(meta).not.toBeNull();
    expect(meta!.entries.map((x) => x.id)).toEqual([e.id]);
    expect(meta!.people.map((x) => x.id)).toEqual([p.id]);
    expect(meta!.places.map((x) => x.id)).toEqual([pl.id]);
    expect(milestonesDb.milestoneWithMeta(m.id, USER_B)).toBeNull();
  });

  it('年份列表与按年浏览', () => {
    milestonesDb.createMilestone(USER_A, { title: 'A', occurred_at: '2021-05-01' });
    const years = milestonesDb.listMilestoneYears(USER_A);
    expect(years).toContain(2021);
    const in2021 = milestonesDb.listMilestones(USER_A, { page: 1, page_size: 100, year: 2021 });
    expect(in2021.items.length).toBeGreaterThanOrEqual(1);
    expect(in2021.items.every((m) => m.occurred_at.startsWith('2021'))).toBe(true);
  });

  it('删除级联清理关联表', () => {
    const m = milestonesDb.createMilestone(USER_A, { title: '临时', occurred_at: '2019-01-01' });
    const mid = m.id;
    milestonesDb.deleteMilestone(USER_A, mid);
    expect(milestonesDb.milestoneWithMeta(mid, USER_A)).toBeNull();
  });
});

describe('人生故事', () => {
  it('创建/查询/排序/删除', () => {
    const e1 = mkEntry({ title: '一', occurred_at: '2022-01-01' });
    const e2 = mkEntry({ title: '二', occurred_at: '2022-02-01' });
    const c = chaptersDb.createChapter(USER_A, { title: '那年夏天', start_date: '2022-01-01' });
    chaptersDb.setChapterEntries(USER_A, c.id, [e2.id, e1.id]);
    const meta = chaptersDb.chapterWithMeta(c.id, USER_A);
    expect(meta!.entries.map((x) => x.id)).toEqual([e2.id, e1.id]); // 按传入顺序
    expect(meta!.entries[0].sort_order).toBeLessThan(meta!.entries[1].sort_order);
    chaptersDb.setChapterEntries(USER_A, c.id, [e1.id]);
    expect(chaptersDb.chapterWithMeta(c.id, USER_A)!.entries.map((x) => x.id)).toEqual([e1.id]);
    chaptersDb.deleteChapter(USER_A, c.id);
    expect(chaptersDb.chapterWithMeta(c.id, USER_A)).toBeNull();
  });
});

describe('记录与档案关联', () => {
  it('entry 挂人物/地点并按 person/place 筛选', () => {
    const p = peopleDb.createPerson(USER_A, { name: '老友' });
    const pl = placesDb.createPlace(USER_A, { name: '咖啡馆' });
    const e = mkEntry({
      title: '和老友喝咖啡',
      occurred_at: '2026-11-08',
      people_ids: [p.id],
      places_ids: [pl.id],
    });
    const meta = entriesDb.entryWithMeta(e.id, USER_A);
    expect(meta!.people.map((x) => x.id)).toEqual([p.id]);
    expect(meta!.places.map((x) => x.id)).toEqual([pl.id]);

    const byPerson = entriesDb.listEntries(USER_A, { page: 1, page_size: 10, person: p.name });
    expect(byPerson.items.some((x) => x.id === e.id)).toBe(true);
    const byPlace = entriesDb.listEntries(USER_A, { page: 1, page_size: 10, place: pl.name });
    expect(byPlace.items.some((x) => x.id === e.id)).toBe(true);

    // 编辑摘除人物后不再命中
    entriesDb.updateEntry(USER_A, e.id, { people_ids: [] });
    const after = entriesDb.listEntries(USER_A, { page: 1, page_size: 10, person: p.name });
    expect(after.items.some((x) => x.id === e.id)).toBe(false);
  });

  it('部分 PATCH（如收藏 toggle）不清空标签/媒体/人物/地点', () => {
    const p = peopleDb.createPerson(USER_A, { name: '守夜人' });
    const e = mkEntry({
      title: '部分更新保护',
      occurred_at: '2026-11-08',
      tags: ['重要', '回忆'],
      people_ids: [p.id],
    });
    // 模拟 EntryActions 的收藏 toggle：只发 is_favorite
    entriesDb.updateEntry(USER_A, e.id, { is_favorite: true });
    const meta = entriesDb.entryWithMeta(e.id, USER_A);
    expect(meta!.is_favorite).toBe(1);
    expect(meta!.tags.map((t) => t.name).sort()).toEqual(['回忆', '重要']);
    expect(meta!.people.map((x) => x.id)).toEqual([p.id]);
  });
});
