import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
import { AiError } from '@/lib/ai';

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string
  ) {
    super(message);
  }
}

export function ok<T>(data: T): NextResponse {
  return NextResponse.json({ ok: true, data });
}

export function fail(status: number, code: string, message: string): NextResponse {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}

/** 包装 Route Handler：统一错误信封 + 异常兜底 */
export function apiHandler(
  handler: (req: NextRequest, ctx: { params: Promise<Record<string, string>> }) => Promise<NextResponse>
) {
  return async (
    req: NextRequest,
    ctx: { params: Promise<Record<string, string>> }
  ): Promise<NextResponse> => {
    try {
      return await handler(req, ctx);
    } catch (err) {
      if (err instanceof HttpError) {
        return fail(err.status, err.code, err.message);
      }
      if (err instanceof AiError) {
        // AI 错误对用户友好可见：未配置/超时/上游失败/结构异常，不吞成 500
        const status = err.code === 'INVALID_RESPONSE' ? 502 : 503;
        return fail(status, err.code, err.message);
      }
      if (err instanceof SyntaxError) {
        return fail(400, 'BAD_JSON', '请求体不是合法 JSON');
      }
      console.error('[evermemo] unhandled api error:', err);
      return fail(500, 'INTERNAL', '服务器出现错误，请稍后重试');
    }
  };
}

/** 从请求中获取当前用户，未登录抛 401 */
export async function requireUser() {
  const user = await getSessionUser();
  if (!user) throw new HttpError(401, 'UNAUTHORIZED', '请先登录');
  return user;
}

/** 简单同源校验（SameSite=Lax 之上的第二道防线） */
export function assertSameOrigin(req: NextRequest): void {
  const origin = req.headers.get('origin');
  const host = req.headers.get('host');
  if (origin && host) {
    try {
      const originHost = new URL(origin).host;
      if (originHost !== host) throw new HttpError(403, 'FORBIDDEN', '请求来源不合法');
    } catch (e) {
      if (e instanceof HttpError) throw e;
      throw new HttpError(403, 'FORBIDDEN', '请求来源不合法');
    }
  }
}
