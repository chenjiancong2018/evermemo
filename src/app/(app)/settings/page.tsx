import { getSessionUser } from '@/lib/auth/session';
import { SettingsView } from '@/components/settings/SettingsView';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const user = await getSessionUser();
  if (!user) return null;
  return (
    <div className="animate-fade-in">
      <h1 className="mb-5 text-[22px] font-semibold">设置</h1>
      <SettingsView
        user={{
          email: user.email,
          display_name: user.display_name,
          bio: user.bio,
          created_at: user.created_at,
        }}
      />
    </div>
  );
}
