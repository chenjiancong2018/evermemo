import { describe, expect, it } from 'vitest';
import {
  entryCreateSchema,
  registerSchema,
  listQuerySchema,
  personCreateSchema,
  personUpdateSchema,
  placeCreateSchema,
  milestoneCreateSchema,
  chapterCreateSchema,
  chapterEntriesSchema,
} from './schemas';

describe('entryCreateSchema', () => {
  const base = { occurred_at: '2026-11-08' };

  it('最小字段可通过并应用默认值', () => {
    const r = entryCreateSchema.parse(base);
    expect(r.title).toBe('');
    expect(r.content).toBe('');
    expect(r.entry_type).toBe('diary');
    expect(r.mood).toBeNull();
    expect(r.tags).toEqual([]);
    expect(r.is_favorite).toBe(false);
  });

  it('拒绝非法类型', () => {
    expect(() => entryCreateSchema.parse({ ...base, entry_type: 'blog' })).toThrow();
  });

  it('拒绝非法心情', () => {
    expect(() => entryCreateSchema.parse({ ...base, mood: '生气' })).toThrow();
  });

  it('拒绝非法日期格式', () => {
    expect(() => entryCreateSchema.parse({ occurred_at: '2026/11/08' })).toThrow();
    expect(() => entryCreateSchema.parse({ occurred_at: '2026-11-08T25:00' })).toThrow();
  });

  it('接受带时间的日期', () => {
    const r = entryCreateSchema.parse({ occurred_at: '2026-11-08T17:31' });
    expect(r.occurred_at).toBe('2026-11-08T17:31');
  });

  it('标题超长被拒绝', () => {
    expect(() => entryCreateSchema.parse({ ...base, title: 'x'.repeat(201) })).toThrow();
  });

  it('标签超过 20 个被拒绝', () => {
    expect(() =>
      entryCreateSchema.parse({ ...base, tags: Array.from({ length: 21 }, (_, i) => `t${i}`) })
    ).toThrow();
  });
});

describe('registerSchema', () => {
  it('邮箱规范化（trim + 小写）', () => {
    const r = registerSchema.parse({ email: '  User@Example.COM ', password: '12345678' });
    expect(r.email).toBe('user@example.com');
  });

  it('拒绝弱密码', () => {
    expect(() => registerSchema.parse({ email: 'a@b.com', password: 'short' })).toThrow();
  });

  it('拒绝非法邮箱', () => {
    expect(() => registerSchema.parse({ email: 'not-an-email', password: '12345678' })).toThrow();
  });
});

describe('listQuerySchema', () => {
  it('默认分页', () => {
    const r = listQuerySchema.parse({});
    expect(r.page).toBe(1);
    expect(r.page_size).toBe(30);
  });

  it('页码钳制（<1 报错）', () => {
    expect(() => listQuerySchema.parse({ page: '0' })).toThrow();
    expect(listQuerySchema.parse({ page: '3' }).page).toBe(3);
  });

  it('favorite 只接受 1', () => {
    expect(listQuerySchema.parse({ favorite: '1' }).favorite).toBe('1');
    expect(() => listQuerySchema.parse({ favorite: 'true' })).toThrow();
  });

  it('person/place 字符串筛选', () => {
    expect(listQuerySchema.parse({ person: '妈妈' }).person).toBe('妈妈');
    expect(listQuerySchema.parse({ place: '洱海' }).place).toBe('洱海');
  });
});

describe('V1.5 档案 schemas', () => {
  it('人物：姓名必填，其余可空', () => {
    const r = personCreateSchema.parse({ name: '妈妈' });
    expect(r.relationship_type).toBeUndefined();
    expect(() => personCreateSchema.parse({})).toThrow();
  });

  it('人物更新：空对象被拒绝（至少一个字段）', () => {
    expect(() => personUpdateSchema.parse({})).toThrow();
    expect(personUpdateSchema.parse({ nickname: '老妈' }).nickname).toBe('老妈');
  });

  it('人物：首次见面日期格式', () => {
    expect(personCreateSchema.parse({ name: 'x', first_met_at: '2020-05-01' }).first_met_at).toBe('2020-05-01');
    expect(() => personCreateSchema.parse({ name: 'x', first_met_at: '2020/05/01' })).toThrow();
  });

  it('地点：名称必填，经纬度范围校验', () => {
    expect(() => placeCreateSchema.parse({})).toThrow();
    expect(placeCreateSchema.parse({ name: '洱海', latitude: 25.6, longitude: 100.2 }).latitude).toBe(25.6);
    expect(() => placeCreateSchema.parse({ name: 'x', latitude: 91 })).toThrow();
    expect(() => placeCreateSchema.parse({ name: 'x', longitude: 181 })).toThrow();
  });

  it('重要时刻：importance 1–3', () => {
    expect(milestoneCreateSchema.parse({ title: '毕业', occurred_at: '2020-06-20' }).importance).toBe(1);
    expect(milestoneCreateSchema.parse({ title: '毕业', occurred_at: '2020-06-20', importance: 3 }).importance).toBe(3);
    expect(() => milestoneCreateSchema.parse({ title: '毕业', occurred_at: '2020-06-20', importance: 4 })).toThrow();
    expect(() => milestoneCreateSchema.parse({ occurred_at: '2020-06-20' })).toThrow();
  });

  it('人生故事：标题必填，起止日期可空', () => {
    expect(chapterCreateSchema.parse({ title: '童年' }).start_date).toBeUndefined();
    expect(() => chapterCreateSchema.parse({})).toThrow();
    expect(() => chapterCreateSchema.parse({ title: 'x', start_date: 'bad' })).toThrow();
  });

  it('故事记录重排：entry_ids 数组', () => {
    expect(chapterEntriesSchema.parse({ entry_ids: [] }).entry_ids).toEqual([]);
    expect(() => chapterEntriesSchema.parse({})).toThrow();
  });
});
