import { getDb } from '@/lib/db';
import type { EntryRow, MediaRow, TagRow, UserRow } from '@/lib/types';
import { entryWithMeta } from '@/lib/db/entries';
import { decryptText, getMasterKey } from '@/lib/crypto/capsule';
import { getVaultKey } from '@/lib/crypto/vault';

interface JoinedRow {
  entry_id?: string;
  person_id?: string;
  place_id?: string;
  milestone_id?: string;
  chapter_id?: string;
  sort_order?: number;
  [key: string]: unknown;
}

/**
 * 全量 JSON 导出（PRD §6.6 数据导出，V1 提前实现，V1.5 扩展档案）：
 * 包含账户资料、全部记录（含标签、人物、地点与媒体元数据）、全部媒体索引、全部标签、
 * 人物/地点/重要时刻/人生故事档案及全部关联表、回收站记录。
 * 不含口令哈希与会话。
 */
export function exportAllData(user: UserRow): string {
  const db = getDb();
  const uid = user.id;
  const entries = db
    .prepare('SELECT * FROM entries WHERE user_id = ? ORDER BY occurred_at ASC, created_at ASC')
    .all(uid) as EntryRow[];
  const media = db
    .prepare('SELECT * FROM media WHERE user_id = ? ORDER BY created_at ASC')
    .all(uid) as MediaRow[];
  const tags = db
    .prepare('SELECT * FROM tags WHERE user_id = ? ORDER BY name COLLATE NOCASE')
    .all(uid) as TagRow[];

  const pick = <T>(rows: T[], keys: string[]): Record<string, unknown>[] =>
    rows.map((r) => {
      const o: Record<string, unknown> = {};
      for (const k of keys) o[k] = (r as Record<string, unknown>)[k];
      return o;
    });

  const people = db.prepare('SELECT * FROM people WHERE user_id = ? ORDER BY created_at ASC').all(uid);
  const places = db.prepare('SELECT * FROM places WHERE user_id = ? ORDER BY created_at ASC').all(uid);
  const milestones = db
    .prepare('SELECT * FROM milestones WHERE user_id = ? ORDER BY occurred_at ASC, created_at ASC')
    .all(uid);
  const chapters = db.prepare('SELECT * FROM chapters WHERE user_id = ? ORDER BY created_at ASC').all(uid);

  const entryPeople = db
    .prepare(
      `SELECT ep.* FROM entry_people ep JOIN entries e ON e.id = ep.entry_id WHERE e.user_id = ? ORDER BY ep.entry_id`
    )
    .all(uid) as JoinedRow[];
  const entryPlaces = db
    .prepare(
      `SELECT epl.* FROM entry_places epl JOIN entries e ON e.id = epl.entry_id WHERE e.user_id = ? ORDER BY epl.entry_id`
    )
    .all(uid) as JoinedRow[];
  const milestoneEntries = db
    .prepare(
      `SELECT me.* FROM milestone_entries me JOIN milestones m ON m.id = me.milestone_id WHERE m.user_id = ? ORDER BY me.milestone_id`
    )
    .all(uid) as JoinedRow[];
  const milestonePeople = db
    .prepare(
      `SELECT mp.* FROM milestone_people mp JOIN milestones m ON m.id = mp.milestone_id WHERE m.user_id = ? ORDER BY mp.milestone_id`
    )
    .all(uid) as JoinedRow[];
  const milestonePlaces = db
    .prepare(
      `SELECT mpl.* FROM milestone_places mpl JOIN milestones m ON m.id = mpl.milestone_id WHERE m.user_id = ? ORDER BY mpl.milestone_id`
    )
    .all(uid) as JoinedRow[];
  const chapterEntries = db
    .prepare(
      `SELECT ce.* FROM chapter_entries ce JOIN chapters c ON c.id = ce.chapter_id WHERE c.user_id = ? ORDER BY ce.chapter_id, ce.sort_order`
    )
    .all(uid) as JoinedRow[];
  const capsules = db
    .prepare('SELECT * FROM memory_capsules WHERE user_id = ? ORDER BY open_at ASC, created_at ASC')
    .all(uid) as Array<{ id: string; content: string; data_key: string | null; [key: string]: unknown }>;
  const capsuleMedia = db
    .prepare(
      `SELECT cm.* FROM capsule_media cm JOIN memory_capsules mc ON mc.id = cm.capsule_id WHERE mc.user_id = ? ORDER BY cm.capsule_id, cm.sort_order`
    )
    .all(uid) as JoinedRow[];
  const aiDrafts = db
    .prepare('SELECT * FROM ai_drafts WHERE user_id = ? ORDER BY created_at ASC')
    .all(uid) as { id: string }[];
  const aiMessages = db
    .prepare('SELECT * FROM ai_messages WHERE user_id = ? ORDER BY created_at ASC')
    .all(uid) as { id: string }[];

  const payload = {
    app: 'evermemo',
    schema_version: 2,
    exported_at: new Date().toISOString(),
    user: {
      id: user.id,
      email: user.email,
      display_name: user.display_name,
      bio: user.bio,
      timezone: user.timezone,
      locale: user.locale,
      created_at: user.created_at,
    },
    entries: entries.map((e) => {
      const withMeta = entryWithMeta(e.id, uid);
      return {
        ...e,
        tags: withMeta?.tags.map((t) => ({ id: t.id, name: t.name, color: t.color })) ?? [],
        media: withMeta?.media.map((m) => m.id) ?? [],
        people: withMeta?.people.map((p) => p.id) ?? [],
        places: withMeta?.places.map((p) => p.id) ?? [],
      };
    }),
    media: media.map((m) => ({
      id: m.id,
      entry_id: m.entry_id,
      file_name: m.file_name,
      storage_path: m.storage_path,
      mime_type: m.mime_type,
      file_size: m.file_size,
      thumbnail_path: m.thumbnail_path,
      width: m.width,
      height: m.height,
      caption: m.caption,
      is_favorite: m.is_favorite,
      captured_at: m.captured_at,
      created_at: m.created_at,
    })),
    tags: tags.map((t) => ({ id: t.id, name: t.name, color: t.color, created_at: t.created_at })),
    people: pick(people, [
      'id',
      'name',
      'nickname',
      'avatar_path',
      'relationship_type',
      'description',
      'first_met_at',
      'notes',
      'created_at',
      'updated_at',
    ]),
    places: pick(places, [
      'id',
      'name',
      'country',
      'city',
      'address',
      'latitude',
      'longitude',
      'description',
      'cover_path',
      'created_at',
      'updated_at',
    ]),
    milestones: pick(milestones, [
      'id',
      'title',
      'description',
      'occurred_at',
      'cover_path',
      'importance',
      'created_at',
      'updated_at',
    ]),
    chapters: pick(chapters, [
      'id',
      'title',
      'description',
      'content',
      'cover_path',
      'start_date',
      'end_date',
      'created_at',
      'updated_at',
    ]),
    relations: {
      entry_people: entryPeople.map((r) => ({ entry_id: r.entry_id, person_id: r.person_id })),
      entry_places: entryPlaces.map((r) => ({ entry_id: r.entry_id, place_id: r.place_id })),
      milestone_entries: milestoneEntries.map((r) => ({ milestone_id: r.milestone_id, entry_id: r.entry_id })),
      milestone_people: milestonePeople.map((r) => ({ milestone_id: r.milestone_id, person_id: r.person_id })),
      milestone_places: milestonePlaces.map((r) => ({ milestone_id: r.milestone_id, place_id: r.place_id })),
      chapter_entries: chapterEntries.map((r) => ({
        chapter_id: r.chapter_id,
        entry_id: r.entry_id,
        sort_order: r.sort_order,
      })),
      capsule_media: capsuleMedia.map((r) => ({ capsule_id: r.capsule_id, media_id: r.media_id, sort_order: r.sort_order })),
    },
    capsules: pick(
      capsules.map((c) => {
        // 导出明文（备份可读语义）；未到期胶囊也导出内容——备份由用户主动生成，视为本人操作。
        // 保险库未解锁时无法解密：保留密文 + locked 标记，绝不静默丢数据。
        let locked = false;
        if (c.data_key && typeof c.content === 'string') {
          let key: Buffer | null = null;
          const vaultKey = getVaultKey(uid);
          if (vaultKey) {
            try {
              const buff = Buffer.from(decryptText(vaultKey, c.data_key), 'base64');
              if (buff.length === 32) key = buff;
            } catch {
              /* 继续尝试旧主密钥 */
            }
          }
          if (!key) {
            try {
              const buff = Buffer.from(decryptText(getMasterKey(), c.data_key), 'base64');
              if (buff.length === 32) key = buff;
            } catch {
              /* 保险库未解锁 */
            }
          }
          if (key) {
            try {
              c.content = decryptText(key, c.content);
            } catch {
              locked = true;
            }
          } else {
            locked = true;
          }
        }
        return locked ? { ...c, locked: true } : c;
      }),
      ['id', 'title', 'content', 'open_at', 'opened_at', 'created_at', 'updated_at', 'locked']
    ),
    ai_drafts: pick(aiDrafts, [
      'id',
      'kind',
      'title',
      'content',
      'meta',
      'source_entry_ids',
      'status',
      'is_mock',
      'created_at',
      'applied_at',
    ]),
    ai_messages: pick(aiMessages, ['id', 'role', 'content', 'citations', 'is_mock', 'created_at']),
  };

  return JSON.stringify(payload, null, 2);
}
