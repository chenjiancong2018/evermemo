import type { NextRequest } from 'next/server';
import { apiHandler, fail, ok, requireUser, assertSameOrigin } from '@/lib/api/http';
import { aiAskSchema } from '@/lib/api/schemas';
import { askQuestion } from '@/lib/ai/features';
import { addMessage, listMessages } from '@/lib/db/ai';

/** AI 人生问答：答案带来源引用，引用可点回原始记录 */
export const POST = apiHandler(async (req: NextRequest) => {
  assertSameOrigin(req);
  const user = await requireUser();
  const body = await req.json();
  const parsed = aiAskSchema.safeParse(body);
  if (!parsed.success) {
    return fail(400, 'VALIDATION', parsed.error.issues[0]?.message ?? '参数不合法');
  }
  const question = parsed.data.question;
  const history = listMessages(user.id, 100)
    .slice(-12)
    .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

  const result = await askQuestion(user.id, question, history);
  addMessage(user.id, { role: 'user', content: question });
  const saved = addMessage(user.id, {
    role: 'assistant',
    content: result.answer,
    citations: result.citations,
    isMock: result.mock,
  });
  return ok({ message: saved, citations: result.citations, mock: result.mock });
});

export const GET = apiHandler(async () => {
  const user = await requireUser();
  return ok({ messages: listMessages(user.id, 100) });
});

export const DELETE = apiHandler(async (req: NextRequest) => {
  assertSameOrigin(req);
  const user = await requireUser();
  const { clearMessages } = await import('@/lib/db/ai');
  clearMessages(user.id);
  return ok({ cleared: true });
});
