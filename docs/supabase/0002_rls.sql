-- Evermemo · Supabase Row Level Security（业务表）
-- 目标：所有业务表默认拒绝，只有「记录所属用户 = auth.uid()」的行可读写。
-- 自建会话模式（sessions 表）下 auth.uid() 不可用；本文件假设已切换到 Supabase Auth
-- （或自定义 JWT，auth.uid() 读取 request.jwt.claims.sub）。
--
-- 执行顺序：0001_schema.sql → 0002_rls.sql → 0004_storage.sql

-- 本地 Postgres / PGlite 验证用的 auth.uid() 桩；Supabase 平台已内置同签名函数。
-- 在 Supabase 上 auth schema 归 supabase_auth_admin 所有、postgres 无权改写，
-- 因此只在「不存在该函数」时创建（平台环境自动跳过）。
do $$
begin
  if not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'auth' and p.proname = 'uid'
  ) then
    execute 'create schema if not exists auth';
    execute $fn$
      create or replace function auth.uid() returns uuid
      language sql stable as $body$
        select (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid;
      $body$;
    $fn$;
  end if;
end $$;

-- ── 用户表 ───────────────────────────────────────────────────
alter table users enable row level security;
drop policy if exists "users 只看自己" on users;
create policy "users 只看自己" on users
  for select using (id = auth.uid());
drop policy if exists "users 只改自己" on users;
create policy "users 只改自己" on users
  for update using (id = auth.uid()) with check (id = auth.uid());

-- ── 会话表（仅服务端 service_role 访问，RLS 只允许读自己的）──
alter table sessions enable row level security;
drop policy if exists "sessions 只看自己" on sessions;
create policy "sessions 只看自己" on sessions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ── 记录 ─────────────────────────────────────────────────────
alter table entries enable row level security;
drop policy if exists "entries 自己的记录" on entries;
create policy "entries 自己的记录" on entries
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ── 媒体 ─────────────────────────────────────────────────────
alter table media enable row level security;
drop policy if exists "media 自己的照片" on media;
create policy "media 自己的照片" on media
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ── 标签与关联表 ─────────────────────────────────────────────
alter table tags enable row level security;
drop policy if exists "tags 自己的标签" on tags;
create policy "tags 自己的标签" on tags
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table entry_tags enable row level security;
drop policy if exists "entry_tags 自己的记录标签" on entry_tags;
create policy "entry_tags 自己的记录标签" on entry_tags
  for all using (
    exists (select 1 from entries e where e.id = entry_tags.entry_id and e.user_id = auth.uid())
  ) with check (
    exists (select 1 from entries e where e.id = entry_tags.entry_id and e.user_id = auth.uid())
    and exists (select 1 from tags t where t.id = entry_tags.tag_id and t.user_id = auth.uid())
  );

-- ── 人物 ─────────────────────────────────────────────────────
alter table people enable row level security;
drop policy if exists "people 自己的人" on people;
create policy "people 自己的人" on people
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table entry_people enable row level security;
drop policy if exists "entry_people 自己的关联" on entry_people;
create policy "entry_people 自己的关联" on entry_people
  for all using (
    exists (select 1 from entries e where e.id = entry_people.entry_id and e.user_id = auth.uid())
  ) with check (
    exists (select 1 from entries e where e.id = entry_people.entry_id and e.user_id = auth.uid())
    and exists (select 1 from people p where p.id = entry_people.person_id and p.user_id = auth.uid())
  );

-- ── 地点 ─────────────────────────────────────────────────────
alter table places enable row level security;
drop policy if exists "places 自己的地点" on places;
create policy "places 自己的地点" on places
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table entry_places enable row level security;
drop policy if exists "entry_places 自己的关联" on entry_places;
create policy "entry_places 自己的关联" on entry_places
  for all using (
    exists (select 1 from entries e where e.id = entry_places.entry_id and e.user_id = auth.uid())
  ) with check (
    exists (select 1 from entries e where e.id = entry_places.entry_id and e.user_id = auth.uid())
    and exists (select 1 from places p where p.id = entry_places.place_id and p.user_id = auth.uid())
  );

-- ── 重要时刻 ─────────────────────────────────────────────────
alter table milestones enable row level security;
drop policy if exists "milestones 自己的时刻" on milestones;
create policy "milestones 自己的时刻" on milestones
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table milestone_entries enable row level security;
drop policy if exists "milestone_entries 自己的关联" on milestone_entries;
create policy "milestone_entries 自己的关联" on milestone_entries
  for all using (
    exists (select 1 from milestones m where m.id = milestone_entries.milestone_id and m.user_id = auth.uid())
  ) with check (
    exists (select 1 from milestones m where m.id = milestone_entries.milestone_id and m.user_id = auth.uid())
    and exists (select 1 from entries e where e.id = milestone_entries.entry_id and e.user_id = auth.uid())
  );

alter table milestone_people enable row level security;
drop policy if exists "milestone_people 自己的关联" on milestone_people;
create policy "milestone_people 自己的关联" on milestone_people
  for all using (
    exists (select 1 from milestones m where m.id = milestone_people.milestone_id and m.user_id = auth.uid())
  ) with check (
    exists (select 1 from milestones m where m.id = milestone_people.milestone_id and m.user_id = auth.uid())
    and exists (select 1 from people p where p.id = milestone_people.person_id and p.user_id = auth.uid())
  );

alter table milestone_places enable row level security;
drop policy if exists "milestone_places 自己的关联" on milestone_places;
create policy "milestone_places 自己的关联" on milestone_places
  for all using (
    exists (select 1 from milestones m where m.id = milestone_places.milestone_id and m.user_id = auth.uid())
  ) with check (
    exists (select 1 from milestones m where m.id = milestone_places.milestone_id and m.user_id = auth.uid())
    and exists (select 1 from places p where p.id = milestone_places.place_id and p.user_id = auth.uid())
  );

-- ── 人生故事 ─────────────────────────────────────────────────
alter table chapters enable row level security;
drop policy if exists "chapters 自己的故事" on chapters;
create policy "chapters 自己的故事" on chapters
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table chapter_entries enable row level security;
drop policy if exists "chapter_entries 自己的关联" on chapter_entries;
create policy "chapter_entries 自己的关联" on chapter_entries
  for all using (
    exists (select 1 from chapters c where c.id = chapter_entries.chapter_id and c.user_id = auth.uid())
  ) with check (
    exists (select 1 from chapters c where c.id = chapter_entries.chapter_id and c.user_id = auth.uid())
    and exists (select 1 from entries e where e.id = chapter_entries.entry_id and e.user_id = auth.uid())
  );

-- ── 记忆胶囊 ─────────────────────────────────────────────────
alter table memory_capsules enable row level security;
drop policy if exists "memory_capsules 自己的胶囊" on memory_capsules;
create policy "memory_capsules 自己的胶囊" on memory_capsules
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table capsule_media enable row level security;
drop policy if exists "capsule_media 自己的关联" on capsule_media;
create policy "capsule_media 自己的关联" on capsule_media
  for all using (
    exists (select 1 from memory_capsules c where c.id = capsule_media.capsule_id and c.user_id = auth.uid())
  ) with check (
    exists (select 1 from memory_capsules c where c.id = capsule_media.capsule_id and c.user_id = auth.uid())
    and exists (select 1 from media m where m.id = capsule_media.media_id and m.user_id = auth.uid())
  );

-- ── AI 草稿与问答 ────────────────────────────────────────────
alter table ai_drafts enable row level security;
drop policy if exists "ai_drafts 自己的草稿" on ai_drafts;
create policy "ai_drafts 自己的草稿" on ai_drafts
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table ai_messages enable row level security;
drop policy if exists "ai_messages 自己的对话" on ai_messages;
create policy "ai_messages 自己的对话" on ai_messages
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ── Data API 权限（关闭「自动暴露新表」时必需）──────────────────
-- 建项目时若取消勾选「自动暴露新表」，新表不会自动授权给 API 角色；
-- 这里显式授权：authenticated 可读写（仍受上面每条 RLS 策略约束），anon 不给任何表权限。
-- 用 DO 块包裹是为了让本地 PGlite 验证（无 anon/authenticated 角色）也能执行本文件。
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'grant usage on schema public to authenticated';
    execute 'grant select, insert, update, delete on all tables in schema public to authenticated';
    execute 'alter default privileges in schema public grant select, insert, update, delete on tables to authenticated';
  end if;
  -- service_role：服务端专用（注册建档、管理操作），绕过 RLS 但仍需表级权限
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant usage on schema public to service_role';
    execute 'grant all privileges on all tables in schema public to service_role';
    execute 'alter default privileges in schema public grant all privileges on tables to service_role';
  end if;
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'grant usage on schema public to anon';
    execute 'revoke all on all tables in schema public from anon';
  end if;
end $$;

-- ── Storage 桶策略见 0004_storage.sql（仅 Supabase 平台提供 storage schema）──
