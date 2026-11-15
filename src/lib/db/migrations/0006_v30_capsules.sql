-- V3.0 人生数字博物馆：记忆胶囊（未来日期开启的信件）
-- 内容明文存储（本地优先产品），未到期不可读由 API 层强制（PRD 无加密要求）。

CREATE TABLE memory_capsules (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  open_at TEXT NOT NULL,          -- YYYY-MM-DD，未来日期开启
  opened_at TEXT,                 -- 首次可读时间（NULL=尚未开启）
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_capsules_user ON memory_capsules(user_id, open_at);

-- 胶囊附带的照片（复用 media 表）
CREATE TABLE capsule_media (
  capsule_id TEXT NOT NULL REFERENCES memory_capsules(id) ON DELETE CASCADE,
  media_id TEXT NOT NULL REFERENCES media(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (capsule_id, media_id)
);
