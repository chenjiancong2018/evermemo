import type { Metadata, Viewport } from 'next';
import './globals.css';
import { PwaRegister } from '@/components/pwa/PwaRegister';

export const metadata: Metadata = {
  title: 'Evermemo · 人生数字档案馆',
  description: '记录每一天，重新走过自己的人生。',
  manifest: '/manifest.webmanifest',
  applicationName: 'Evermemo',
  appleWebApp: {
    capable: true,
    title: 'Evermemo',
    statusBarStyle: 'default',
  },
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180' }],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#F8F7F3',
};

/**
 * 首屏主题预置：在样式生效前把 data-theme 写到 <html>，避免深色模式下白屏闪烁。
 * 与 src/components/theme/ThemeToggle.tsx 中的 STORAGE_KEY / resolveTheme 保持一致。
 */
const THEME_BOOTSTRAP = `(function(){try{var m=localStorage.getItem('evermemo-theme');var d=m==='dark'||(m!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches);var r=document.documentElement;r.dataset.theme=d?'dark':'light';r.style.colorScheme=d?'dark':'light';var meta=document.querySelector('meta[name="theme-color"]');if(meta)meta.setAttribute('content',d?'#171612':'#F8F7F3');}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="min-h-dvh">
        {/* 首屏主题预置：body 内容渲染前执行，避免深色模式闪白 */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
