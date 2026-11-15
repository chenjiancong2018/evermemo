import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from './password';

describe('password', () => {
  it('哈希后可验证通过', async () => {
    const h = await hashPassword('correct horse battery staple');
    expect(h).toContain('scrypt$');
    expect(await verifyPassword('correct horse battery staple', h)).toBe(true);
  });

  it('错误密码验证失败', async () => {
    const h = await hashPassword('right-password-123');
    expect(await verifyPassword('wrong-password-123', h)).toBe(false);
  });

  it('相同密码两次哈希不同（盐随机）', async () => {
    const a = await hashPassword('same-password');
    const b = await hashPassword('same-password');
    expect(a).not.toBe(b);
    expect(await verifyPassword('same-password', a)).toBe(true);
    expect(await verifyPassword('same-password', b)).toBe(true);
  });

  it('拒绝伪造格式的哈希', async () => {
    expect(await verifyPassword('x', 'not-a-hash')).toBe(false);
    expect(await verifyPassword('x', '')).toBe(false);
  });
});
