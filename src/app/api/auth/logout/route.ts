import { cookies } from 'next/headers';
import { destroySession, getSessionUser, SESSION_COOKIE } from '@/lib/auth/session';
import { clearVaultKey } from '@/lib/crypto/vault';
import { apiHandler, ok } from '@/lib/api/http';

export const POST = apiHandler(async () => {
  const user = await getSessionUser();
  if (user) clearVaultKey(user.id);
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) destroySession(token);
  store.set(SESSION_COOKIE, '', { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 0 });
  return ok({ logged_out: true });
});
