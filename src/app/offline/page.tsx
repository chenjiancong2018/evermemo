import Link from 'next/link';

export const metadata = {
  title: '暂时离线 · Evermemo',
};

export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-background px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-soft text-accent">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="12" cy="12" r="9" />
          <path d="M8 12h8" strokeLinecap="round" />
        </svg>
      </div>
      <h1 className="mt-6 text-[20px] font-semibold text-foreground">暂时离线了</h1>
      <p className="mt-2 max-w-sm text-[14px] leading-relaxed text-muted">
        你的记忆一直安全地保存在本机服务器上。连上网络后刷新页面即可继续查看与记录。
      </p>
      <Link href="/home" className="btn-primary mt-6 px-6">
        重新连接
      </Link>
    </main>
  );
}
