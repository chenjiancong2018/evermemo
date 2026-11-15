import { randomBytes, scryptSync } from 'node:crypto';
import { decryptText, encryptText } from './capsule';

/**
 * 用户级数据保险库。
 *
 * - 每个用户一个随机 32 字节「数据密钥」，用「口令派生密钥（KEK）」包裹后存 users.vault_key。
 * - KEK = scrypt(登录口令, vault_salt)；口令本身从不落盘。
 * - 解包后的数据密钥只存在于服务端内存缓存（12 小时），登录/解锁时写入，退出登录时清除。
 * - 忘记登录口令 = 胶囊正文不可解（密文保留），这是「由口令派生」的固有代价。
 */

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LEN = 32;
/** 解锁状态在内存中的有效期 */
export const UNLOCK_TTL_MS = 12 * 60 * 60 * 1000;

/** 由登录口令 + salt 派生 KEK（与口令哈希使用同一套 scrypt 参数） */
export function deriveKek(password: string, saltHex: string): Buffer {
  return scryptSync(password, Buffer.from(saltHex, 'hex'), KEY_LEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: 64 * 1024 * 1024,
  });
}

export interface VaultCreation {
  salt: string;
  /** 包裹后的数据密钥（AES-256-GCM 密文） */
  wrapped: string;
  dataKey: Buffer;
}

/** 新建保险库：随机数据密钥 + 随机 salt，用口令包裹 */
export function createVault(password: string): VaultCreation {
  const salt = randomBytes(16).toString('hex');
  const dataKey = randomBytes(KEY_LEN);
  const kek = deriveKek(password, salt);
  return { salt, wrapped: encryptText(kek, dataKey.toString('base64')), dataKey };
}

/** 用口令解开保险库数据密钥；口令错误或数据损坏返回 null */
export function unlockVault(password: string, saltHex: string, wrapped: string): Buffer | null {
  try {
    const kek = deriveKek(password, saltHex);
    const b64 = decryptText(kek, wrapped);
    const key = Buffer.from(b64, 'base64');
    return key.length === KEY_LEN ? key : null;
  } catch {
    return null;
  }
}

/** 用口令重新包裹一个既有数据密钥（改口令时使用） */
export function wrapDataKey(password: string, dataKey: Buffer): { salt: string; wrapped: string } {
  const salt = randomBytes(16).toString('hex');
  const kek = deriveKek(password, salt);
  return { salt, wrapped: encryptText(kek, dataKey.toString('base64')) };
}

// ── 内存解锁缓存 ─────────────────────────────────────────────────

const unlocked = new Map<string, { key: Buffer; expiresAt: number }>();

export function setVaultKey(userId: string, key: Buffer): void {
  unlocked.set(userId, { key, expiresAt: Date.now() + UNLOCK_TTL_MS });
}

export function getVaultKey(userId: string): Buffer | null {
  const entry = unlocked.get(userId);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    unlocked.delete(userId);
    return null;
  }
  return entry.key;
}

export function clearVaultKey(userId: string): void {
  unlocked.delete(userId);
}

export function isVaultUnlocked(userId: string): boolean {
  return getVaultKey(userId) !== null;
}

/** 仅供测试：清空全部缓存 */
export function clearAllVaultKeys(): void {
  unlocked.clear();
}

// ── 恢复码（防止忘记登录口令后胶囊正文永久不可读）──────────────────
//
// 恢复码 = 20 字节随机数（160 bit）的 Crockford Base32 编码，共 32 个字符，
// 按 4 字符分组显示（XXXX-XXXX-…）。它不落盘：服务端只保存
// recovery_salt 与「用恢复码派生 KEK 包裹的数据密钥」。
// 忘记登录口令时，凭「邮箱 + 恢复码 + 新口令」即可重设口令并取回同一数据密钥，
// 密码胶囊（旧胶囊）也随之继续可读。

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const RECOVERY_BYTES = 20; // 160 bit
const RECOVERY_CHARS = 32; // 160 / 5

/** 把随机字节编码成 Crockford Base32（去除易混淆字符 I/L/O/U） */
function encodeCrockford(bytes: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += CROCKFORD[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += CROCKFORD[(value << (5 - bits)) & 31];
  return out;
}

/** 生成一个恢复码（显示格式：4 字符一组，共 8 组） */
export function generateRecoveryCode(): string {
  const raw = encodeCrockford(randomBytes(RECOVERY_BYTES));
  return raw.slice(0, RECOVERY_CHARS).match(/.{1,4}/g)!.join('-');
}

/**
 * 规范化用户输入的恢复码：忽略大小写、空格与连字符，
 * 并把易混淆字符映射回合法字符（O→0，I/L→1）。
 * 非法字符会让结果包含非字母表字符，校验时返回空串。
 */
export function normalizeRecoveryCode(input: string): string {
  const cleaned = String(input)
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, '')
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1');
  if (cleaned.length !== RECOVERY_CHARS) return '';
  if (![...cleaned].every((ch) => CROCKFORD.includes(ch))) return '';
  return cleaned;
}

export interface RecoveryCreation {
  /** 明文恢复码（只返回一次，不落盘） */
  code: string;
  /** 恢复码派生 KEK 所用的 salt（hex） */
  salt: string;
  /** 用恢复码 KEK 包裹后的数据密钥（AES-256-GCM 密文） */
  wrapped: string;
}

/** 生成恢复码并把数据密钥用它包裹 */
export function createRecovery(dataKey: Buffer): RecoveryCreation {
  const code = generateRecoveryCode();
  const salt = randomBytes(16).toString('hex');
  const kek = deriveKek(normalizeRecoveryCode(code), salt);
  return { code, salt, wrapped: encryptText(kek, dataKey.toString('base64')) };
}

/** 用恢复码解开数据密钥；恢复码错误或数据损坏返回 null */
export function unlockWithRecovery(recoveryCode: string, saltHex: string, wrapped: string): Buffer | null {
  const normalized = normalizeRecoveryCode(recoveryCode);
  if (!normalized) return null;
  try {
    const kek = deriveKek(normalized, saltHex);
    const b64 = decryptText(kek, wrapped);
    const key = Buffer.from(b64, 'base64');
    return key.length === KEY_LEN ? key : null;
  } catch {
    return null;
  }
}
