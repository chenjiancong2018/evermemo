import { randomBytes } from 'node:crypto';
import { getDb } from './index';
import { decryptText, encryptText, getMasterKey } from '@/lib/crypto/capsule';
import { getVaultKey } from '@/lib/crypto/vault';
import type { MediaRow } from '@/lib/types';

export interface CapsuleRow {
  id: string;
  user_id: string;
  title: string;
  /** 存储形态：新胶囊为 `v1:` 密文，旧数据可能为明文 */
  content: string;
  /** 加密的数据密钥（`v1:` 密文），旧数据为 null */
  data_key: string | null;
  open_at: string;
  opened_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CapsuleWithMeta extends CapsuleRow {
  media: MediaRow[];
  /** 当前是否已到开启日期（服务端判定） */
  openable: boolean;
  /** 是否已被打开过 */
  opened: boolean;
  /** 正文是否因保险库未解锁而不可读（只有 openable 的胶囊会真正锁定） */
  locked: boolean;
}

export interface CapsuleInput {
  title: string;
  content: string;
  open_at: string;
  media_ids?: string[];
}

/** 今天的本地日期（YYYY-MM-DD） */
export function todayStr(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const ROW = `c.id, c.user_id, c.title, c.content, c.data_key, c.open_at, c.opened_at, c.created_at, c.updated_at`;

function rowToCapsule(r: Record<string, unknown>): CapsuleRow {
  return {
    id: r.id as string,
    user_id: r.user_id as string,
    title: r.title as string,
    content: r.content as string,
    data_key: (r.data_key as string | null) ?? null,
    open_at: r.open_at as string,
    opened_at: (r.opened_at as string | null) ?? null,
    created_at: r.created_at as string,
    updated_at: r.updated_at as string,
  };
}

/** 解开 data_key：优先保险库密钥（口令派生），失败回退旧主密钥（v1 兼容） */
function unwrapDataKey(userId: string, dataKey: string): Buffer | null {
  const vaultKey = getVaultKey(userId);
  if (vaultKey) {
    try {
      const buff = Buffer.from(decryptText(vaultKey, dataKey), 'base64');
      if (buff.length === 32) return buff;
    } catch {
      /* 不是保险库密钥包裹的，继续试旧主密钥 */
    }
  }
  try {
    const buff = Buffer.from(decryptText(getMasterKey(), dataKey), 'base64');
    if (buff.length === 32) return buff;
  } catch {
    /* 无法解开（保险库未解锁） */
  }
  return null;
}

/**
 * 解密胶囊正文。
 * - data_key 为空（旧明文胶囊）→ 原文返回；
 * - 保险库未解锁且无法回退旧主密钥 → `{ content: '', locked: true }`，由调用方决定是否隐藏。
 */
function decryptContent(userId: string, capsule: CapsuleRow): { content: string; locked: boolean } {
  if (!capsule.data_key) return { content: capsule.content, locked: false };
  const key = unwrapDataKey(userId, capsule.data_key);
  if (!key) return { content: '', locked: true };
  try {
    return { content: decryptText(key, capsule.content), locked: false };
  } catch {
    return { content: '', locked: true };
  }
}

/**
 * 加密正文 → { content 密文, data_key 密文 }。
 * 包裹 data_key 的密钥：保险库已解锁 → 用户保险库密钥；否则 → 旧主密钥（兼容模式）。
 */
function encryptContent(userId: string, plain: string, existingDataKey: string | null = null) {
  const wrapKey = getVaultKey(userId) ?? getMasterKey();
  const key = (existingDataKey ? unwrapDataKey(userId, existingDataKey) : null) ?? randomBytes32();
  return { content: encryptText(key, plain), data_key: encryptText(wrapKey, key.toString('base64')) };
}

function randomBytes32(): Buffer {
  return randomBytes(32);
}

/** 读取媒体行（跨表查询 media 表） */
function capsuleMedia(db: ReturnType<typeof getDb>, capsuleId: string): MediaRow[] {
  const rows = db
    .prepare(
      `SELECT m.* FROM capsule_media cm
       JOIN media m ON m.id = cm.media_id
       WHERE cm.capsule_id = ?
       ORDER BY cm.sort_order, cm.media_id`
    )
    .all(capsuleId) as unknown as MediaRow[];
  return rows;
}

/**
 * 单条胶囊。未到开启日期时 content 置空（服务器端强制「未到期不可读」），
 * 到期后返回完整内容并顺带记录 opened_at。
 */
export function getCapsule(userId: string, id: string): CapsuleWithMeta | null {
  const db = getDb();
  const row = db.prepare(`SELECT ${ROW} FROM memory_capsules c WHERE c.id = ? AND c.user_id = ?`).get(id, userId) as
    | Record<string, unknown>
    | undefined;
  if (!row) return null;
  const capsule = rowToCapsule(row);
  const openable = capsule.open_at <= todayStr();
  if (openable && !capsule.opened_at) {
    db.prepare(`UPDATE memory_capsules SET opened_at = ? WHERE id = ?`).run(new Date().toISOString(), id);
    capsule.opened_at = new Date().toISOString();
  }
  const dec = openable ? decryptContent(userId, capsule) : { content: '', locked: false };
  return {
    ...capsule,
    media: capsuleMedia(db, id),
    openable,
    opened: !!capsule.opened_at,
    locked: dec.locked,
    // 未到期：内容不可读（产品仪式感 + API 层强制）；到期且解锁后解密返回
    content: dec.content,
  };
}

export interface CapsuleListQuery {
  page?: number;
  page_size?: number;
  /** opened=待开启 / opened=已开启 / all=全部 */
  status?: 'locked' | 'opened' | 'all';
}

/** 列表。未到期胶囊 content 置空、openable=false。 */
export function listCapsules(userId: string, q: CapsuleListQuery = {}) {
  const db = getDb();
  const page = Math.max(1, q.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, q.page_size ?? 20));
  const where = ['c.user_id = ?'];
  const params: unknown[] = [userId];
  const today = todayStr();
  if (q.status === 'locked') where.push('c.open_at > ?'), params.push(today);
  if (q.status === 'opened') where.push('c.open_at <= ?'), params.push(today);
  const whereSql = where.join(' AND ');
  const { total } = db.prepare(`SELECT COUNT(*) AS total FROM memory_capsules c WHERE ${whereSql}`).get(...params) as { total: number };
  const rows = db
    .prepare(
      `SELECT ${ROW} FROM memory_capsules c WHERE ${whereSql}
       ORDER BY c.open_at ASC, c.created_at ASC LIMIT ? OFFSET ?`
    )
    .all(...params, pageSize, (page - 1) * pageSize) as unknown as Record<string, unknown>[];
  const items: CapsuleWithMeta[] = rows.map((r) => {
    const capsule = rowToCapsule(r);
    const openable = capsule.open_at <= today;
    const dec = openable ? decryptContent(userId, capsule) : { content: '', locked: false };
    return {
      ...capsule,
      media: capsuleMedia(db, capsule.id),
      openable,
      opened: !!capsule.opened_at,
      locked: dec.locked,
      content: dec.content,
    };
  });
  return { items, total, page, page_size: pageSize };
}

export function createCapsule(userId: string, input: CapsuleInput): CapsuleWithMeta {
  const db = getDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const mediaIds = (input.media_ids ?? []).filter(Boolean);
  const enc = encryptContent(userId, input.content);
  db.transaction(() => {
    db.prepare(
      `INSERT INTO memory_capsules (id, user_id, title, content, data_key, open_at, opened_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?)`
    ).run(id, userId, input.title, enc.content, enc.data_key, input.open_at, now, now);
    // 校验媒体归属本人后挂接
    if (mediaIds.length > 0) {
      const placeholders = mediaIds.map(() => '?').join(',');
      const mine = db
        .prepare(`SELECT id FROM media WHERE user_id = ? AND id IN (${placeholders})`)
        .all(userId, ...mediaIds) as unknown as { id: string }[];
      const mineIds = new Set(mine.map((m) => m.id));
      const insert = db.prepare(
        `INSERT INTO capsule_media (capsule_id, media_id, sort_order) VALUES (?, ?, ?)`
      );
      mediaIds.forEach((mid, i) => {
        if (mineIds.has(mid)) insert.run(id, mid, i);
      });
    }
  })();
  return getCapsule(userId, id)!;
}

export function updateCapsule(userId: string, id: string, input: Partial<CapsuleInput>): CapsuleWithMeta | null {
  const db = getDb();
  const row = db.prepare(`SELECT ${ROW} FROM memory_capsules c WHERE c.id = ? AND c.user_id = ?`).get(id, userId) as
    | Record<string, unknown>
    | undefined;
  if (!row) return null;
  const capsule = rowToCapsule(row);
  // 已开启的胶囊不可再编辑（信件已寄出）
  if (capsule.open_at <= todayStr()) return null;
  const title = input.title ?? capsule.title;
  // 正文：显式传入时重新加密（沿用或新建数据密钥）；保险库锁定时无法重加密，拒绝修改正文
  if (input.content !== undefined && capsule.data_key && !unwrapDataKey(userId, capsule.data_key)) {
    return null;
  }
  const enc = input.content !== undefined ? encryptContent(userId, input.content, capsule.data_key) : null;
  const content = enc?.content ?? capsule.content;
  const dataKey = enc?.data_key ?? capsule.data_key;
  const openAt = input.open_at ?? capsule.open_at;
  const mediaIds = input.media_ids ?? capsuleMedia(db, id).map((m) => m.id);
  db.transaction(() => {
    db.prepare(`UPDATE memory_capsules SET title = ?, content = ?, data_key = ?, open_at = ?, updated_at = ? WHERE id = ?`).run(
      title,
      content,
      dataKey,
      openAt,
      new Date().toISOString(),
      id
    );
    db.prepare(`DELETE FROM capsule_media WHERE capsule_id = ?`).run(id);
    const placeholders = mediaIds.map(() => '?').join(',');
    if (mediaIds.length > 0) {
      const mine = db
        .prepare(`SELECT id FROM media WHERE user_id = ? AND id IN (${placeholders})`)
        .all(userId, ...mediaIds) as unknown as { id: string }[];
      const mineIds = new Set(mine.map((m) => m.id));
      const insert = db.prepare(
        `INSERT INTO capsule_media (capsule_id, media_id, sort_order) VALUES (?, ?, ?)`
      );
      mediaIds.forEach((mid, i) => {
        if (mineIds.has(mid)) insert.run(id, mid, i);
      });
    }
  })();
  return getCapsule(userId, id);
}

export function deleteCapsule(userId: string, id: string): boolean {
  const db = getDb();
  const info = db.prepare(`DELETE FROM memory_capsules WHERE id = ? AND user_id = ?`).run(id, userId);
  return info.changes > 0;
}
