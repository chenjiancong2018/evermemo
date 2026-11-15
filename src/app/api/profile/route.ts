import type { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { apiHandler, fail, ok, requireUser, assertSameOrigin } from '@/lib/api/http';
import { profileSchema } from '@/lib/api/schemas';

export const PUT = apiHandler(async (req: NextRequest) => {
  assertSameOrigin(req);
  const user = await requireUser();
  const body = await req.json();
  const parsed = profileSchema.safeParse(body);
  if (!parsed.success) {
    return fail(400, 'VALIDATION', parsed.error.issues[0]?.message ?? '参数不合法');
  }
  const { display_name, bio, timezone, locale } = parsed.data;

  const db = getDb();
  db.prepare(
    `UPDATE users SET display_name = ?, bio = ?, timezone = ?, locale = ?, updated_at = ? WHERE id = ?`
  ).run(display_name, bio, timezone, locale, new Date().toISOString(), user.id);

  return ok({ updated: true });
});
