-- 记忆胶囊加密：每胶囊随机数据密钥（经主密钥加密后存 data_key）
ALTER TABLE memory_capsules ADD COLUMN data_key TEXT;
