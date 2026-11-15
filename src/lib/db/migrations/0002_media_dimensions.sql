-- 媒体尺寸（用于画廊瀑布流预留宽高比）
ALTER TABLE media ADD COLUMN width INTEGER;
ALTER TABLE media ADD COLUMN height INTEGER;
