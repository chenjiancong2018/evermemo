import { getDb } from '@/lib/db';
import { HttpError } from '@/lib/api/http';
import { isVaultUnlocked } from '@/lib/crypto/vault';

/** 用户是否已有保险库（旧账号首次登录时才建立） */
export function userHasVault(userId: string): boolean {
  const row = getDb().prepare('SELECT vault_salt, vault_key FROM users WHERE id = ?').get(userId) as
    | { vault_salt: string | null; vault_key: string | null }
    | undefined;
  return !!(row?.vault_salt && row?.vault_key);
}

/** 有保险库但未解锁时，禁止写入胶囊正文（避免用服务器主密钥降级包裹） */
export function assertVaultReady(userId: string): void {
  if (userHasVault(userId) && !isVaultUnlocked(userId)) {
    throw new HttpError(423, 'VAULT_LOCKED', '记忆胶囊已加密锁定，请先输入登录密码解锁');
  }
}
