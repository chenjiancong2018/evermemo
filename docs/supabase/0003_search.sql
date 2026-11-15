-- Evermemo · Supabase 全文搜索（pg_trgm）
-- 对应 SQLite 侧 entries_fts FTS5 trigram 表。中文场景 trigram + ILIKE 是最稳的方案。
-- 执行顺序：0001_schema.sql → 0003_search.sql（0002_rls.sql 可先后执行）

create extension if not exists pg_trgm;

-- 标题与正文的 trigram GIN 索引（加速 ILIKE '%词%'）
create index if not exists idx_entries_title_trgm  on entries using gin (title   gin_trgm_ops);
create index if not exists idx_entries_content_trgm on entries using gin (content gin_trgm_ops);
create index if not exists idx_tags_name_trgm      on tags    using gin (name    gin_trgm_ops);

-- 与 src/lib/db/entries.ts 中 listEntries 的 q 行为对齐：
-- 长度 >= 3 时走索引；更短或含特殊字符时退化为应用层 LIKE（索引不友好但结果一致）。
-- 调用方（db 层）应拼成：title ILIKE $1 OR content ILIKE $1，参数为 '%' || q || '%'。
