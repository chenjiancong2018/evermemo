/**
 * 保险库加密测试：口令派生 KEK、数据密钥包裹/解包、改口令重包裹、解锁缓存。
 */
import { describe, it, expect, afterAll } from 'vitest';
import {
  clearAllVaultKeys,
  clearVaultKey,
  createRecovery,
  createVault,
  deriveKek,
  generateRecoveryCode,
  getVaultKey,
  isVaultUnlocked,
  normalizeRecoveryCode,
  setVaultKey,
  unlockVault,
  unlockWithRecovery,
  wrapDataKey,
} from './vault';

describe('记忆胶囊保险库', () => {
  afterAll(() => clearAllVaultKeys());

  it('创建保险库：正确口令可解出数据密钥，错误口令解不出', () => {
    const vault = createVault('correct horse battery staple');
    expect(vault.dataKey.length).toBe(32);
    expect(vault.salt.length).toBe(32); // 16 字节 hex

    const unlocked = unlockVault('correct horse battery staple', vault.salt, vault.wrapped);
    expect(unlocked).not.toBeNull();
    expect(unlocked!.equals(vault.dataKey)).toBe(true);

    expect(unlockVault('wrong password', vault.salt, vault.wrapped)).toBeNull();
  });

  it('改口令：旧口令解包 → 新口令重包裹，数据密钥不变', () => {
    const vault = createVault('old-pass');
    const dataKey = unlockVault('old-pass', vault.salt, vault.wrapped)!;
    const rewrapped = wrapDataKey('new-pass', dataKey);

    expect(unlockVault('old-pass', rewrapped.salt, rewrapped.wrapped)).toBeNull();
    const viaNew = unlockVault('new-pass', rewrapped.salt, rewrapped.wrapped);
    expect(viaNew).not.toBeNull();
    expect(viaNew!.equals(dataKey)).toBe(true);
  });

  it('同一口令 + 不同 salt 派生出不同 KEK', () => {
    const a = deriveKek('same', 'aa'.repeat(16));
    const b = deriveKek('same', 'bb'.repeat(16));
    expect(a.equals(b)).toBe(false);
  });

  it('解锁缓存：设置、读取、锁定、过期语义', () => {
    const userId = 'u1';
    expect(isVaultUnlocked(userId)).toBe(false);
    setVaultKey(userId, Buffer.alloc(32, 7));
    expect(isVaultUnlocked(userId)).toBe(true);
    expect(getVaultKey(userId)!.length).toBe(32);
    clearVaultKey(userId);
    expect(getVaultKey(userId)).toBeNull();
  });

  it('恢复码格式：32 字符 Crockford Base32，4 字符一组共 8 组', () => {
    const code = generateRecoveryCode();
    expect(code).toMatch(/^([0-9A-HJKMNP-TV-Z]{4}-){7}[0-9A-HJKMNP-TV-Z]{4}$/);
    expect(normalizeRecoveryCode(code)).toBe(code.replaceAll('-', ''));
    // 忽略大小写、横线、空格与易混字母
    const messy = ' ' + code.toLowerCase().replaceAll('-', ' ') + ' ';
    expect(normalizeRecoveryCode(messy)).toBe(code.replaceAll('-', ''));
    // 太短 / 含非法字符 → 空串
    expect(normalizeRecoveryCode('ABC')).toBe('');
    expect(normalizeRecoveryCode('!'.repeat(32))).toBe('');
  });

  it('恢复码包裹数据密钥：正确恢复码可解，错误恢复码解不出', () => {
    const dataKey = Buffer.alloc(32, 9);
    const recovery = createRecovery(dataKey);
    expect(recovery.code).toMatch(/^[0-9A-HJKMNP-TV-Z-]{39}$/);
    expect(recovery.salt.length).toBe(32);

    const viaCode = unlockWithRecovery(recovery.code, recovery.salt, recovery.wrapped);
    expect(viaCode).not.toBeNull();
    expect(viaCode!.equals(dataKey)).toBe(true);

    // 小写、无横线也能用
    const lower = recovery.code.toLowerCase().replaceAll('-', '');
    expect(unlockWithRecovery(lower, recovery.salt, recovery.wrapped)!.equals(dataKey)).toBe(true);

    const wrong = generateRecoveryCode();
    expect(unlockWithRecovery(wrong, recovery.salt, recovery.wrapped)).toBeNull();
    expect(unlockWithRecovery('not-a-code', recovery.salt, recovery.wrapped)).toBeNull();
  });
});
