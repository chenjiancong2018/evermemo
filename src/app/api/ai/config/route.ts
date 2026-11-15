import type { NextRequest } from 'next/server';
import { apiHandler, ok, requireUser } from '@/lib/api/http';
import { getAiPublicConfig } from '@/lib/ai';

/** AI 公开配置（绝不包含 API Key）：configured / mock / model / apiBase */
export const GET = apiHandler(async () => {
  await requireUser();
  return ok(getAiPublicConfig());
});
