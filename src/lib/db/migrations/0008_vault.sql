-- 0008：用户级数据保险库（胶囊主密钥改为由登录口令派生）
--
-- 设计：
-- - 每个用户一个随机 32 字节「保险库数据密钥」，用「口令派生密钥（KEK）」包裹后存 users.vault_key；
--   KEK = scrypt(登录口令, users.vault_salt)，salt 每次设置/修改口令时重新生成。
-- - 服务器仅在会话内（内存缓存，12 小时）持有解包后的数据密钥：
--   登录 / 注册 / 解锁时解包；退出登录或缓存过期后，胶囊正文再次需要解锁。
-- - memory_capsules.data_key 仍存「被包裹的数据密钥」；升级前用服务器 secret 派生的主密钥包裹，
--   读取时先尝试保险库密钥、失败再回退旧主密钥（向后兼容，旧胶囊不需要重新加密）。
-- - 忘记登录口令 = 无法解出胶囊密钥（密文保留但不可读）；JSON 导出在锁定时保留密文。

alter table users add column vault_salt TEXT;
alter table users add column vault_key TEXT;
