-- Evermemo · Supabase / PostgreSQL schema
-- 由 SQLite 迁移脚本（0001_init → 0007_capsule_encryption）逐表平移而来。
-- 约定：
--   * 主键使用 uuid（Postgres 原生 gen_random_uuid()）
--   * occurred_at / captured_at / open_at 等「用户本地时间」保留 text，
--     理由：Evermemo 不换算时区，'YYYY-MM-DD[THH:mm]' 字符串按字典序即为时间序，
--     与 V1–V3 的 SQLite 语义完全一致，迁移前后行为不变。
--   * 布尔字段使用 boolean（SQLite 的 0/1）
--   * 其余时间戳（created_at/updated_at/applied_at/opened_at/deleted_at）使用 timestamptz
--   * 照片文件不入库：storage_path 指向 Supabase Storage 桶内路径
-- 执行顺序：0001_schema.sql → 0002_rls.sql → 0003_search.sql（可选）

-- gen_random_uuid() 从 Postgres 13 起是内置函数，无需 pgcrypto 扩展。

-- ── 用户与会话 ────────────────────────────────────────────────
create table if not exists users (
  id            uuid primary key default gen_random_uuid(),
  email         text not null unique,
  password_hash text not null,            -- 若改用 Supabase Auth 可留空字符串
  display_name  text,
  bio           text,
  created_at    timestamptz not null default now()
);

create table if not exists sessions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_sessions_user on sessions(user_id);

-- ── 记录 ─────────────────────────────────────────────────────
create table if not exists entries (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references users(id) on delete cascade,
  title        text not null default '',
  content      text not null default '',
  entry_type   text not null check (entry_type in ('diary','moment','photo','idea','event','travel','custom')),
  occurred_at  text not null,             -- YYYY-MM-DD 或 YYYY-MM-DDTHH:mm（本地时间，不换算）
  mood         text,
  is_important boolean not null default false,
  is_favorite  boolean not null default false,
  is_archived  boolean not null default false,
  deleted_at   timestamptz,               -- 软删除（回收站）
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists idx_entries_user_occurred on entries(user_id, occurred_at desc);
create index if not exists idx_entries_user_type on entries(user_id, entry_type);
create index if not exists idx_entries_user_deleted on entries(user_id, deleted_at);

-- ── 媒体 ─────────────────────────────────────────────────────
create table if not exists media (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references users(id) on delete cascade,
  entry_id       uuid references entries(id) on delete set null,
  file_name      text not null,
  storage_path   text not null,
  mime_type      text not null,
  file_size      bigint not null,
  thumbnail_path text,
  media_type     text not null default 'image',
  caption        text not null default '',
  is_favorite    boolean not null default false,
  captured_at    text,                    -- EXIF 拍摄时间 YYYY-MM-DDTHH:mm
  width          integer,
  height         integer,
  created_at     timestamptz not null default now()
);
create index if not exists idx_media_user_entry on media(user_id, entry_id);
create index if not exists idx_media_user_captured on media(user_id, captured_at desc);

-- ── 标签 ─────────────────────────────────────────────────────
create table if not exists tags (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete cascade,
  name       text not null,
  color      text,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create table if not exists entry_tags (
  entry_id uuid not null references entries(id) on delete cascade,
  tag_id   uuid not null references tags(id) on delete cascade,
  primary key (entry_id, tag_id)
);
create index if not exists idx_entry_tags_tag on entry_tags(tag_id);

-- ── 人物档案 ─────────────────────────────────────────────────
create table if not exists people (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references users(id) on delete cascade,
  name              text not null,
  nickname          text,
  avatar_path       text,
  relationship_type text,
  description       text,
  first_met_at      text,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists idx_people_user on people(user_id);

create table if not exists entry_people (
  entry_id  uuid not null references entries(id) on delete cascade,
  person_id uuid not null references people(id) on delete cascade,
  primary key (entry_id, person_id)
);
create index if not exists idx_entry_people_person on entry_people(person_id);

-- ── 地点档案 ─────────────────────────────────────────────────
create table if not exists places (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id) on delete cascade,
  name        text not null,
  country     text,
  city        text,
  address     text,
  latitude    double precision,
  longitude   double precision,
  description text,
  cover_path  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_places_user on places(user_id);

create table if not exists entry_places (
  entry_id uuid not null references entries(id) on delete cascade,
  place_id uuid not null references places(id) on delete cascade,
  primary key (entry_id, place_id)
);
create index if not exists idx_entry_places_place on entry_places(place_id);

-- ── 重要时刻 ─────────────────────────────────────────────────
create table if not exists milestones (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id) on delete cascade,
  title       text not null,
  description text,
  occurred_at text not null,
  cover_path  text,
  importance  smallint not null default 1 check (importance between 1 and 3),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_milestones_user on milestones(user_id, occurred_at desc);

create table if not exists milestone_entries (
  milestone_id uuid not null references milestones(id) on delete cascade,
  entry_id     uuid not null references entries(id) on delete cascade,
  primary key (milestone_id, entry_id)
);
create table if not exists milestone_people (
  milestone_id uuid not null references milestones(id) on delete cascade,
  person_id    uuid not null references people(id) on delete cascade,
  primary key (milestone_id, person_id)
);
create table if not exists milestone_places (
  milestone_id uuid not null references milestones(id) on delete cascade,
  place_id     uuid not null references places(id) on delete cascade,
  primary key (milestone_id, place_id)
);

-- ── 人生故事 ─────────────────────────────────────────────────
create table if not exists chapters (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id) on delete cascade,
  title       text not null,
  description text,
  content     text,
  cover_path  text,
  start_date  text,
  end_date    text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_chapters_user on chapters(user_id, start_date);

create table if not exists chapter_entries (
  chapter_id uuid not null references chapters(id) on delete cascade,
  entry_id   uuid not null references entries(id) on delete cascade,
  sort_order integer not null default 0,
  primary key (chapter_id, entry_id)
);
create index if not exists idx_chapter_entries_entry on chapter_entries(entry_id);

-- ── 记忆胶囊（V3.0/V3.1：内容与密钥均为密文）─────────────────
create table if not exists memory_capsules (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete cascade,
  title      text not null,
  content    text not null,               -- v1:<iv>:<tag>:<cipher>（AES-256-GCM）
  data_key   text,                        -- 主密钥加密后的胶囊密钥；NULL = 历史明文行
  open_at    text not null,               -- YYYY-MM-DD
  opened_at  timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_capsules_user on memory_capsules(user_id, open_at);

create table if not exists capsule_media (
  capsule_id uuid not null references memory_capsules(id) on delete cascade,
  media_id   uuid not null references media(id) on delete cascade,
  sort_order integer not null default 0,
  primary key (capsule_id, media_id)
);

-- ── AI 草稿与问答（V2.0）─────────────────────────────────────
create table if not exists ai_drafts (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references users(id) on delete cascade,
  kind             text not null check (kind in ('organize','review','ask','yearly','story')),
  title            text not null default '',
  content          text not null default '',
  meta             jsonb not null default '{}'::jsonb,
  source_entry_ids jsonb not null default '[]'::jsonb,
  status           text not null default 'pending' check (status in ('pending','applied','discarded')),
  is_mock          boolean not null default false,
  created_at       timestamptz not null default now(),
  applied_at       timestamptz
);
create index if not exists idx_ai_drafts_user_kind on ai_drafts(user_id, kind, created_at desc);

create table if not exists ai_messages (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete cascade,
  role       text not null check (role in ('user','assistant')),
  content    text not null,
  citations  jsonb not null default '[]'::jsonb,
  is_mock    boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_ai_messages_user on ai_messages(user_id, created_at);
