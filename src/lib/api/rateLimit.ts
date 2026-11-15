/**
 * 极简内存限流器（单进程 & 本地优先部署足够）。
 *
 * 用途：找回密码、解锁保险库等敏感入口，防止被暴力尝试。
 * 说明：多实例部署时各实例独立计数；如需跨实例请换 Redis/数据库实现。
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

/** 清理过期桶，避免内存无界增长 */
function sweep(now: number): void {
  if (buckets.size < 2000) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

/**
 * 消耗一次配额。
 * @returns allowed=false 时 retryAfterMs 表示还要等多久
 */
export function takeToken(
  key: string,
  limit: number,
  windowMs: number
): { allowed: boolean; remaining: number; retryAfterMs: number } {
  const now = Date.now();
  sweep(now);
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfterMs: 0 };
  }
  if (bucket.count >= limit) {
    return { allowed: false, remaining: 0, retryAfterMs: bucket.resetAt - now };
  }
  bucket.count += 1;
  return { allowed: true, remaining: limit - bucket.count, retryAfterMs: 0 };
}

/** 成功后清空计数（例如正确完成找回密码） */
export function resetTokens(key: string): void {
  buckets.delete(key);
}

/** 仅供测试 */
export function clearAllTokens(): void {
  buckets.clear();
}
