/** 记录类型（PRD §2.2） */
export const ENTRY_TYPES = [
  'diary',
  'moment',
  'photo',
  'idea',
  'event',
  'travel',
  'custom',
] as const;
export type EntryType = (typeof ENTRY_TYPES)[number];

export const ENTRY_TYPE_LABELS: Record<EntryType, string> = {
  diary: '日记',
  moment: '瞬间',
  photo: '照片',
  idea: '想法',
  event: '事件',
  travel: '旅行',
  custom: '自定义',
};

/** 心情（PRD §2.2，仅用户自主记录） */
export const MOODS = ['开心', '平静', '兴奋', '感动', '疲惫', '难过', '焦虑', '其他'] as const;
export type Mood = (typeof MOODS)[number];

export const MOOD_COLORS: Record<Mood, string> = {
  开心: '#C9A227',
  平静: '#7B9A8F',
  兴奋: '#D98E4A',
  感动: '#B9807A',
  疲惫: '#8B8B8B',
  难过: '#6E7FA8',
  焦虑: '#9A7B8F',
  其他: '#A39B8E',
};

export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  display_name: string;
  avatar_path: string | null;
  bio: string;
  timezone: string;
  locale: string;
  created_at: string;
  updated_at: string;
  /** 保险库 salt（0008 起；旧库为 null） */
  vault_salt: string | null;
  /** 保险库数据密钥（口令派生 KEK 包裹后的密文；旧库为 null） */
  vault_key: string | null;
  /** 恢复码派生 KEK 所用的 salt（0009 起；未设置恢复码时为 null） */
  recovery_salt: string | null;
  /** 用恢复码 KEK 包裹的数据密钥（0009 起；未设置恢复码时为 null） */
  recovery_key: string | null;
}

export interface EntryRow {
  id: string;
  user_id: string;
  title: string;
  content: string;
  content_format: string;
  entry_type: EntryType;
  occurred_at: string;
  created_at: string;
  updated_at: string;
  mood: Mood | null;
  is_favorite: number;
  is_important: number;
  is_archived: number;
  deleted_at: string | null;
}

export interface MediaRow {
  id: string;
  user_id: string;
  entry_id: string | null;
  file_name: string;
  storage_path: string;
  mime_type: string;
  file_size: number;
  thumbnail_path: string | null;
  media_type: string;
  caption: string;
  is_favorite: number;
  captured_at: string | null;
  width: number | null;
  height: number | null;
  created_at: string;
}

export interface TagRow {
  id: string;
  user_id: string;
  name: string;
  color: string | null;
  created_at: string;
}

/** 对外输出的记录（带标签与媒体元数据） */
export interface EntryWithMeta extends EntryRow {
  tags: TagRow[];
  media: MediaRow[];
  people: PersonRow[];
  places: PlaceRow[];
}

/* ============ V1.5 人生整理系统 ============ */

/** 重要程度（PRD §2.5 设置重要程度） */
export const IMPORTANCE_LEVELS = [1, 2, 3] as const;
export type ImportanceLevel = (typeof IMPORTANCE_LEVELS)[number];

export const IMPORTANCE_LABELS: Record<ImportanceLevel, string> = {
  1: '重要',
  2: '很重要',
  3: '一生铭记',
};

export interface PersonRow {
  id: string;
  user_id: string;
  name: string;
  nickname: string | null;
  avatar_path: string | null; // 存 media.id
  relationship_type: string | null;
  description: string | null;
  first_met_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface PlaceRow {
  id: string;
  user_id: string;
  name: string;
  country: string | null;
  city: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  description: string | null;
  cover_path: string | null; // 存 media.id
  created_at: string;
  updated_at: string;
}

export interface MilestoneRow {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  occurred_at: string;
  cover_path: string | null; // 存 media.id
  importance: ImportanceLevel;
  created_at: string;
  updated_at: string;
}

export interface ChapterRow {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  content: string | null;
  cover_path: string | null; // 存 media.id
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface MilestoneWithMeta extends MilestoneRow {
  cover: MediaRow | null;
  entries: EntryWithMeta[];
  people: PersonRow[];
  places: PlaceRow[];
}

export interface PersonWithMeta extends PersonRow {
  avatar: MediaRow | null;
  entryCount: number;
  photoCount: number;
  sharedMilestones: MilestoneRow[];
}

export interface PlaceWithMeta extends PlaceRow {
  cover: MediaRow | null;
  entryCount: number;
  photoCount: number;
}

export interface ChapterWithMeta extends ChapterRow {
  cover: MediaRow | null;
  entries: (EntryWithMeta & { sort_order: number })[];
}
