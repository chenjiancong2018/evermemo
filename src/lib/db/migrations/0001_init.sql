-- EVERMEMO 初始 Schema
-- 表名/字段名与 PRD §4 一致，便于未来迁移到 PostgreSQL/Supabase。
-- 时间统一为 ISO-8601 文本（created_at/updated_at 为 UTC，occurred_at/captured_at 为用户记录的发生时间）。

CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name  TEXT NOT NULL DEFAULT '',
  avatar_path   TEXT,
  bio           TEXT NOT NULL DEFAULT '',
  timezone      TEXT NOT NULL DEFAULT 'Asia/Shanghai',
  locale        TEXT NOT NULL DEFAULT 'zh-CN',
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS entries (
  id             TEXT PRIMARY KEY,
  user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title          TEXT NOT NULL DEFAULT '',
  content        TEXT NOT NULL DEFAULT '',
  content_format TEXT NOT NULL DEFAULT 'md',
  entry_type     TEXT NOT NULL DEFAULT 'diary',
  occurred_at    TEXT NOT NULL,
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL,
  mood           TEXT,
  is_favorite    INTEGER NOT NULL DEFAULT 0,
  is_important   INTEGER NOT NULL DEFAULT 0,
  is_archived    INTEGER NOT NULL DEFAULT 0,
  deleted_at     TEXT
);
CREATE INDEX IF NOT EXISTS idx_entries_user_occurred ON entries(user_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_entries_user_type    ON entries(user_id, entry_type);
CREATE INDEX IF NOT EXISTS idx_entries_user_deleted ON entries(user_id, deleted_at);

CREATE TABLE IF NOT EXISTS media (
  id             TEXT PRIMARY KEY,
  user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entry_id       TEXT REFERENCES entries(id) ON DELETE SET NULL,
  file_name      TEXT NOT NULL,
  storage_path   TEXT NOT NULL,
  mime_type      TEXT NOT NULL,
  file_size      INTEGER NOT NULL,
  thumbnail_path TEXT,
  media_type     TEXT NOT NULL DEFAULT 'image',
  caption        TEXT NOT NULL DEFAULT '',
  is_favorite    INTEGER NOT NULL DEFAULT 0,
  captured_at    TEXT,
  created_at     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_media_user_entry    ON media(user_id, entry_id);
CREATE INDEX IF NOT EXISTS idx_media_user_captured ON media(user_id, captured_at DESC);

CREATE TABLE IF NOT EXISTS tags (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  color      TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(user_id, name)
);

CREATE TABLE IF NOT EXISTS entry_tags (
  entry_id TEXT NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  tag_id   TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (entry_id, tag_id)
);

-- 全文检索：trigram 分词器对中文子串检索有效（V2 语义检索将换 pgvector）
-- 必须带 content='entries'：FTS5 的 'delete' 特殊命令仅对带 content= 选项的表可用，
-- 否则 UPDATE/DELETE 触发器中的 'delete' 会抛 "SQL logic error"。
CREATE VIRTUAL TABLE IF NOT EXISTS entries_fts USING fts5(
  title, content,
  content='entries', content_rowid='rowid',
  tokenize = 'trigram'
);

CREATE TRIGGER IF NOT EXISTS entries_fts_ai AFTER INSERT ON entries BEGIN
  INSERT INTO entries_fts(rowid, title, content) VALUES (new.rowid, new.title, new.content);
END;
CREATE TRIGGER IF NOT EXISTS entries_fts_ad AFTER DELETE ON entries BEGIN
  INSERT INTO entries_fts(entries_fts, rowid, title, content) VALUES ('delete', old.rowid, old.title, old.content);
END;
CREATE TRIGGER IF NOT EXISTS entries_fts_au AFTER UPDATE ON entries BEGIN
  INSERT INTO entries_fts(entries_fts, rowid, title, content) VALUES ('delete', old.rowid, old.title, old.content);
  INSERT INTO entries_fts(rowid, title, content) VALUES (new.rowid, new.title, new.content);
END;
