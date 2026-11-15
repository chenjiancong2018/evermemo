-- Evermemo · V3.5 恢复码
-- 目的：登录口令遗忘时，用户仍可用「恢复码」取回数据密钥并重置口令。
-- 设计：
--   recovery_salt  随机 16 字节（hex），用于从恢复码派生 KEK
--   recovery_key   用恢复码派生的 KEK 包裹的「数据密钥」密文（v1:iv:tag:cipher）
--   恢复码本身只显示一次、不落盘；忘记口令 + 丢失恢复码 = 胶囊正文不可恢复。
--   生成/重新生成恢复码需要提供登录口令（证明是本人）。
alter table users add column recovery_salt TEXT;
alter table users add column recovery_key  TEXT;
