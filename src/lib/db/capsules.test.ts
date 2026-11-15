/**
 * 记忆胶囊数据层测试：未到期不可读、到期开启、编辑限制、媒体归属校验、导出含胶囊。
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'evermemo-capsules-'));
process.env.DATABASE_PATH = path.join(tmp, 'test.db');
process.env.DATA_DIR = tmp;
process.env.UPLOADS_DIR = path.join(tmp, 'uploads');
fs.mkdirSync(process.env.UPLOADS_DIR, { recursive: true });

const { getDb, closeDb } = await import('./index');
const db = getDb(); // getDb() 内部自动按序应用全部迁移
const capsules = await import('./capsules');
const { exportAllData } = await import('../api/export');

const USER_A = 'user-a';
const USER_B = 'user-b';
const now = new Date();
const iso = (d: Date) => d.toISOString();
const future = (days: number) => {
  const d = new Date(now);
  d.setDate(d.getDate() + days);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
const past = (days: number) => {
  const d = new Date(now);
  d.setDate(d.getDate() - days);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

db.prepare(
  `INSERT INTO users (id, email, password_hash, display_name, created_at, updated_at)
   VALUES (?, ?, 'x', ?, ?, ?)`
).run(USER_A, 'a@test.local', '甲', iso(now), iso(now));
db.prepare(
  `INSERT INTO users (id, email, password_hash, display_name, created_at, updated_at)
   VALUES (?, ?, 'x', ?, ?, ?)`
).run(USER_B, 'b@test.local', '乙', iso(now), iso(now));

let mediaIdA: string;
let capsuleFutureId: string;
let capsuleOpenId: string;

beforeAll(() => {
  db.prepare(
    `INSERT INTO media (id, user_id, entry_id, file_name, storage_path, mime_type, file_size, thumbnail_path, width, height, caption, is_favorite, captured_at, created_at)
     VALUES (?, ?, NULL, 'a.jpg', 'a/orig.jpg', 'image/jpeg', 10, NULL, 10, 10, '', 0, NULL, ?)`
  ).run('media-a', USER_A, iso(now));
  db.prepare(
    `INSERT INTO media (id, user_id, entry_id, file_name, storage_path, mime_type, file_size, thumbnail_path, width, height, caption, is_favorite, captured_at, created_at)
     VALUES (?, ?, NULL, 'b.jpg', 'b/orig.jpg', 'image/jpeg', 10, NULL, 10, 10, '', 0, NULL, ?)`
  ).run('media-b', USER_B, iso(now));
  mediaIdA = 'media-a';
});

describe('记忆胶囊', () => {
  it('创建未来胶囊：未到期不可读，content 为空', () => {
    const c = capsules.createCapsule(USER_A, {
      title: '给十年后的自己',
      content: '你还好吗？',
      open_at: future(30),
      media_ids: ['media-a', 'media-b', 'ghost-id'], // 他人媒体与幽灵 id 应被忽略
    });
    capsuleFutureId = c.id;
    expect(c.openable).toBe(false);
    expect(c.content).toBe('');
    expect(c.media.length).toBe(1);
    expect(c.media[0].id).toBe('media-a');
    // 列表同样不可读
    const list = capsules.listCapsules(USER_A, { status: 'locked' });
    expect(list.total).toBe(1);
    expect(list.items[0].content).toBe('');
  });

  it('加密落库：DB 直读为 v1 密文，data_key 加密存储', () => {
    const row = db.prepare('SELECT content, data_key FROM memory_capsules WHERE id = ?').get(capsuleFutureId) as {
      content: string;
      data_key: string;
    };
    expect(row.content.startsWith('v1:')).toBe(true);
    expect(row.content).not.toContain('你还好吗');
    expect(row.data_key.startsWith('v1:')).toBe(true);
  });

  it('旧明文数据兼容（data_key 为空时按明文读取）', () => {
    const id = 'legacy-capsule';
    db.prepare(
      `INSERT INTO memory_capsules (id, user_id, title, content, data_key, open_at, opened_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, NULL, ?, NULL, ?, ?)`
    ).run(id, USER_A, '旧信', '明文内容', past(2), iso(now), iso(now));
    const c = capsules.getCapsule(USER_A, id)!;
    expect(c.openable).toBe(true);
    expect(c.content).toBe('明文内容');
    db.prepare('DELETE FROM memory_capsules WHERE id = ?').run(id);
  });

  it('保险库用户：解锁时可读，锁定后正文不可读但密文保留，重新解锁恢复', async () => {
    const vault = await import('../crypto/vault');
    const userC = 'user-c';
    const v = vault.createVault('vault-pass');
    db.prepare(
      `INSERT INTO users (id, email, password_hash, display_name, created_at, updated_at, vault_salt, vault_key)
       VALUES (?, ?, 'x', ?, ?, ?, ?, ?)`
    ).run(userC, 'c@test.local', '丙', iso(now), iso(now), v.salt, v.wrapped);
    vault.setVaultKey(userC, v.dataKey);

    const c = capsules.createCapsule(userC, { title: '加密信', content: '只有解锁才能读', open_at: past(1) });
    expect(c.openable).toBe(true);
    expect(c.locked).toBe(false);
    expect(c.content).toBe('只有解锁才能读');

    // 锁定：正文不可读、locked=true，但密文仍在库里
    vault.clearVaultKey(userC);
    const lockedView = capsules.getCapsule(userC, c.id)!;
    expect(lockedView.locked).toBe(true);
    expect(lockedView.content).toBe('');
    const row = db.prepare('SELECT content FROM memory_capsules WHERE id = ?').get(c.id) as { content: string };
    expect(row.content.startsWith('v1:')).toBe(true);

    // 锁定时导出：保留密文 + locked 标记，不静默丢数据
    const json = exportAllData({
      id: userC,
      email: 'c@test.local',
      password_hash: 'x',
      display_name: '丙',
      bio: null,
      timezone: null,
      locale: null,
      created_at: iso(now),
      updated_at: iso(now),
    } as never);
    const payload = JSON.parse(json) as { capsules: { content: string; locked?: boolean }[] };
    expect(payload.capsules[0].locked).toBe(true);
    expect(payload.capsules[0].content.startsWith('v1:')).toBe(true);

    // 重新解锁：正文恢复可读，导出恢复明文
    vault.setVaultKey(userC, v.dataKey);
    expect(capsules.getCapsule(userC, c.id)!.content).toBe('只有解锁才能读');
    const json2 = exportAllData({
      id: userC,
      email: 'c@test.local',
      password_hash: 'x',
      display_name: '丙',
      bio: null,
      timezone: null,
      locale: null,
      created_at: iso(now),
      updated_at: iso(now),
    } as never);
    const payload2 = JSON.parse(json2) as { capsules: { content: string; locked?: boolean }[] };
    expect(payload2.capsules[0].content).toBe('只有解锁才能读');
    expect(payload2.capsules[0].locked).toBeUndefined();
  });

  it('到期胶囊自动开启并可读（opened_at 落库）', () => {
    const c = capsules.createCapsule(USER_A, { title: '昨天的信', content: '时光机', open_at: past(1) });
    capsuleOpenId = c.id;
    expect(c.openable).toBe(true);
    expect(c.opened).toBe(true);
    expect(c.content).toBe('时光机');
    const again = capsules.getCapsule(USER_A, c.id)!;
    expect(again.opened_at).toBeTruthy();
    expect(again.content).toBe('时光机');
  });

  it('未到期可编辑；已到期不可编辑（ALREADY 语义：返回 null）', () => {
    const updated = capsules.updateCapsule(USER_A, capsuleFutureId, { title: '改过的标题' });
    expect(updated?.title).toBe('改过的标题');
    const locked = capsules.updateCapsule(USER_A, capsuleOpenId, { title: '想改' });
    expect(locked).toBeNull();
  });

  it('用户隔离：他人看不到也删不掉', () => {
    expect(capsules.getCapsule(USER_B, capsuleFutureId)).toBeNull();
    expect(capsules.deleteCapsule(USER_B, capsuleFutureId)).toBe(false);
    expect(capsules.listCapsules(USER_B).total).toBe(0);
  });

  it('删除胶囊', () => {
    expect(capsules.deleteCapsule(USER_A, capsuleFutureId)).toBe(true);
    expect(capsules.getCapsule(USER_A, capsuleFutureId)).toBeNull();
  });

  it('导出包含胶囊与 AI 数据（schema_version=2）', () => {
    const json = exportAllData({
      id: USER_A,
      email: 'a@test.local',
      password_hash: 'x',
      display_name: '甲',
      bio: null,
      timezone: null,
      locale: null,
      created_at: iso(now),
      updated_at: iso(now),
    } as never);
    const payload = JSON.parse(json) as {
      schema_version: number;
      capsules: { title: string; content: string }[];
      relations: { capsule_media: unknown[] };
    };
    expect(payload.schema_version).toBe(2);
    expect(payload.capsules.length).toBe(1);
    expect(payload.capsules[0].title).toBe('昨天的信');
    expect(payload.capsules[0].content).toBe('时光机');
    expect(payload.relations.capsule_media.length).toBe(0);
  });
});

afterAll(() => {
  closeDb();
});
