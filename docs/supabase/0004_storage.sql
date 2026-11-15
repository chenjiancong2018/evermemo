-- Evermemo · Supabase Storage 桶策略
-- 仅适用于 Supabase 平台（storage schema 由平台提供）。本地 Postgres / PGlite 验证时跳过本文件。
--
-- 约定路径：<userId>/<uuid>.<ext>（原图）与 <userId>/thumbs/<uuid>.webp（缩略图），
-- 与 V1.0 本地磁盘布局一致，便于从 JSON 导出重建。

insert into storage.buckets (id, name, public)
values ('media', 'media', false)
on conflict (id) do nothing;

drop policy if exists "media 桶只看自己的目录" on storage.objects;
create policy "media 桶只看自己的目录" on storage.objects
  for select using (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "media 桶只写自己的目录" on storage.objects;
create policy "media 桶只写自己的目录" on storage.objects
  for insert with check (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "media 桶只改自己的目录" on storage.objects;
create policy "media 桶只改自己的目录" on storage.objects
  for update using (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "media 桶只删自己的目录" on storage.objects;
create policy "media 桶只删自己的目录" on storage.objects
  for delete using (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
