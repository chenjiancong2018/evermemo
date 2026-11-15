-- V1.5 人生整理系统：重要时刻、人物档案、地点档案、人生故事
-- 表名/字段名严格对应 PRD §4；补充字段见各表注释。

-- 4.6 people 人物档案（补充 first_met_at 初识日期、notes 备注——PRD §2.6 功能字段要求）
CREATE TABLE people (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  nickname TEXT,
  avatar_path TEXT,           -- 存 media.id（复用 media 表与私有访问）
  relationship_type TEXT,
  description TEXT,
  first_met_at TEXT,          -- YYYY-MM-DD
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_people_user ON people(user_id);

-- 4.7 entry_people 记录与人物多对多
CREATE TABLE entry_people (
  entry_id TEXT NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  person_id TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  PRIMARY KEY (entry_id, person_id)
);
CREATE INDEX idx_entry_people_person ON entry_people(person_id);

-- 4.8 places 地点档案（PRD 无 updated_at，编辑需要，补充）
CREATE TABLE places (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  country TEXT,
  city TEXT,
  address TEXT,
  latitude REAL,
  longitude REAL,
  description TEXT,
  cover_path TEXT,            -- 存 media.id
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_places_user ON places(user_id);

-- 4.9 entry_places 记录与地点多对多
CREATE TABLE entry_places (
  entry_id TEXT NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  place_id TEXT NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  PRIMARY KEY (entry_id, place_id)
);
CREATE INDEX idx_entry_places_place ON entry_places(place_id);

-- 4.10 milestones 重要时刻
CREATE TABLE milestones (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  occurred_at TEXT NOT NULL,  -- 与 entries.occurred_at 同格式 YYYY-MM-DD[THH:mm]
  cover_path TEXT,            -- 存 media.id
  importance INTEGER NOT NULL DEFAULT 1,  -- 1 重要 / 2 很重要 / 3 一生铭记
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_milestones_user ON milestones(user_id, occurred_at DESC);

-- 里程碑关联（PRD §2.5：关联日记/人物/地点）
CREATE TABLE milestone_entries (
  milestone_id TEXT NOT NULL REFERENCES milestones(id) ON DELETE CASCADE,
  entry_id TEXT NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  PRIMARY KEY (milestone_id, entry_id)
);
CREATE TABLE milestone_people (
  milestone_id TEXT NOT NULL REFERENCES milestones(id) ON DELETE CASCADE,
  person_id TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  PRIMARY KEY (milestone_id, person_id)
);
CREATE TABLE milestone_places (
  milestone_id TEXT NOT NULL REFERENCES milestones(id) ON DELETE CASCADE,
  place_id TEXT NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  PRIMARY KEY (milestone_id, place_id)
);

-- 4.11 chapters 人生故事
CREATE TABLE chapters (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  content TEXT,
  cover_path TEXT,            -- 存 media.id
  start_date TEXT,            -- YYYY-MM-DD
  end_date TEXT,              -- YYYY-MM-DD
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_chapters_user ON chapters(user_id, start_date);

-- 4.12 chapter_entries 故事与记录多对多（含排序）
CREATE TABLE chapter_entries (
  chapter_id TEXT NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  entry_id TEXT NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (chapter_id, entry_id)
);
CREATE INDEX idx_chapter_entries_entry ON chapter_entries(entry_id);
