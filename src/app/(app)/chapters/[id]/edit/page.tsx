import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { getSessionUser } from '@/lib/auth/session';
import { chapterWithMeta } from '@/lib/db/chapters';
import { ChapterForm } from '@/components/chapters/ChapterForm';

export const dynamic = 'force-dynamic';

export default async function ChapterEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) return null;

  const chapter = chapterWithMeta(id, user.id);
  if (!chapter) notFound();

  return (
    <div className="animate-fade-in mx-auto max-w-[640px] space-y-4">
      <Link
        href={`/chapters/${chapter.id}`}
        className="inline-flex items-center gap-1.5 text-[13px] text-muted transition-colors hover:text-accent"
      >
        <ArrowLeft size={15} />
        返回故事
      </Link>
      <h1 className="text-[22px] font-semibold">编辑故事</h1>
      <ChapterForm chapter={chapter} standalone />
    </div>
  );
}
