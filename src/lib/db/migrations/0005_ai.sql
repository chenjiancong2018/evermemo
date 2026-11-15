-- V2.0 AI 人生助手：AI 草稿（与原始记录严格分离）+ 问答会话
PRAGMA foreign_keys = ON;

CREATE TABLE ai_drafts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('organize', 'review', 'ask', 'yearly', 'story')),
  title TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  meta TEXT NOT NULL DEFAULT '{}',      -- JSON：来源/建议标签/类型/时间范围等
  source_entry_ids TEXT NOT NULL DEFAULT '[]', -- JSON 字符串数组：引用的记录 id
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'applied', 'discarded')),
  is_mock INTEGER NOT NULL DEFAULT 0,   -- 1 = 开发 mock 响应（与生产隔离标记）
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  applied_at TEXT
);

CREATE INDEX idx_ai_drafts_user_kind ON ai_drafts(user_id, kind, created_at DESC);

CREATE TABLE ai_messages (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  citations TEXT NOT NULL DEFAULT '[]', -- JSON 字符串数组：{id, title, occurred_at}
  is_mock INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX idx_ai_messages_user ON ai_messages(user_id, created_at);
