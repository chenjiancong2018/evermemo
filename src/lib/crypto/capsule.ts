import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { getSessionSecret } from '@/lib/config';

/**
 * 记忆胶囊加密（AES-256-GCM）。
 * - 每胶囊一个随机 32 字节数据密钥，用「主密钥」加密后存 data_key 列。
 * - 主密钥由 data/secret（会话签名密钥）经 sha256 派生：与登录口令无关，
 *   改密不影响解密；secret 文件泄露 = 主密钥泄露（本地优先产品，风险面=直读数据库）。
 * - content 列存密文，格式 `v1:<ivB64>:<tagB64>:<cipherB64>`；
 *   无前缀的旧数据（V3.0 明文）视为明文兼容读取。
 */

const PREFIX = 'v1:';

/** 主密钥：sha256('evermemo-capsules:' + sessionSecret) */
export function getMasterKey(): Buffer {
  return createHash('sha256').update(`evermemo-capsules:${getSessionSecret()}`).digest();
}

/** AES-256-GCM 加密 → `v1:<iv>:<tag>:<cipher>`（base64） */
export function encryptText(key: Buffer, plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString('base64')}:${tag.toString('base64')}:${enc.toString('base64')}`;
}

/** 解密 `v1:...` 密文；无前缀（旧明文数据）原样返回 */
export function decryptText(key: Buffer, blob: string): string {
  if (!blob.startsWith(PREFIX)) return blob;
  const parts = blob.slice(PREFIX.length).split(':');
  if (parts.length !== 3) return blob;
  const [ivB64, tagB64, dataB64] = parts;
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]).toString('utf8');
}
