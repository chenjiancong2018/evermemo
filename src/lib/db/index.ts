import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { DB_PATH, ensureDataDirs } from '@/lib/config';

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;
  ensureDataDirs();
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  runMigrations(db);
  return db;
}

const MIGRATIONS_DIR = path.join(process.cwd(), 'src', 'lib', 'db', 'migrations');

/** 按文件名顺序执行未应用的迁移；结构变更只允许通过迁移文件进行。 */
export function runMigrations(database: Database.Database): void {
  database.exec(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
       version TEXT PRIMARY KEY,
       applied_at TEXT NOT NULL
     )`
  );
  const applied = new Set(
    database
      .prepare('SELECT version FROM schema_migrations')
      .all()
      .map((r) => (r as { version: string }).version)
  );
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    const apply = database.transaction(() => {
      database.exec(sql);
      database
        .prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)')
        .run(file, new Date().toISOString());
    });
    apply();
  }
}

/** 关闭数据库（测试用） */
export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
