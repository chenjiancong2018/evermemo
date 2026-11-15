-- 修复 FTS5 表：FTS5 的 'delete' 特殊命令仅对带 content= 选项的表可用，
-- 否则 UPDATE/DELETE 触发器会抛 "SQL logic error"。
-- 重建 entries_fts（content='entries'）并从 entries 重新索引。
DROP TRIGGER IF EXISTS entries_fts_ai;
DROP TRIGGER IF EXISTS entries_fts_ad;
DROP TRIGGER IF EXISTS entries_fts_au;
DROP TABLE IF EXISTS entries_fts;

CREATE VIRTUAL TABLE entries_fts USING fts5(
  title, content,
  content='entries', content_rowid='rowid',
  tokenize = 'trigram'
);

INSERT INTO entries_fts(rowid, title, content)
  SELECT rowid, title, content FROM entries;

CREATE TRIGGER entries_fts_ai AFTER INSERT ON entries BEGIN
  INSERT INTO entries_fts(rowid, title, content) VALUES (new.rowid, new.title, new.content);
END;
CREATE TRIGGER entries_fts_ad AFTER DELETE ON entries BEGIN
  INSERT INTO entries_fts(entries_fts, rowid, title, content) VALUES ('delete', old.rowid, old.title, old.content);
END;
CREATE TRIGGER entries_fts_au AFTER UPDATE ON entries BEGIN
  INSERT INTO entries_fts(entries_fts, rowid, title, content) VALUES ('delete', old.rowid, old.title, old.content);
  INSERT INTO entries_fts(rowid, title, content) VALUES (new.rowid, new.title, new.content);
END;
