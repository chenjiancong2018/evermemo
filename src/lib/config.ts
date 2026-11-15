import path from 'node:path';
import fs from 'node:fs';
import { randomBytes } from 'node:crypto';

/** 项目根目录（src/lib 的上级两级） */
export const ROOT_DIR = path.resolve(process.cwd());

/** 数据目录：数据库与上传文件都放在这里，整体复制/备份即可 */
export const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(ROOT_DIR, 'data');

export const DB_PATH = process.env.DATABASE_PATH
  ? path.resolve(process.env.DATABASE_PATH)
  : path.join(DATA_DIR, 'evermemo.db');

export const UPLOADS_DIR = process.env.UPLOADS_DIR
  ? path.resolve(process.env.UPLOADS_DIR)
  : path.join(DATA_DIR, 'uploads');

/** 会话 Cookie 签名密钥（未配置时自动生成并持久化到 data/secret） */
let cachedSecret: string | null = null;
export function getSessionSecret(): string {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  if (cachedSecret) return cachedSecret;
  const secretPath = path.join(DATA_DIR, 'secret');
  fs.mkdirSync(DATA_DIR, { recursive: true });
  try {
    cachedSecret = fs.readFileSync(secretPath, 'utf8').trim();
  } catch {
    const secret = randomBytes(32).toString('hex');
    cachedSecret = secret;
    fs.writeFileSync(secretPath, secret, { mode: 0o600 });
  }
  return cachedSecret!;
}

export function ensureDataDirs(): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

/** 图片限制 */
export const MAX_IMAGE_BYTES = 20 * 1024 * 1024; // 20MB
export const ALLOWED_IMAGE_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);
