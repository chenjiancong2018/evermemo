'use client';

/**
 * 注册 Service Worker（PWA 离线外壳）。
 * 只在生产环境注册：开发模式的 HMR 与 SW 缓存容易互相干扰。
 * 注册失败不阻塞页面（例如浏览器禁用 SW / 非 https 环境）。
 */

import { useEffect } from 'react';

export function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;
    const register = () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        /* 忽略：不影响使用 */
      });
    };
    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });
    return () => window.removeEventListener('load', register);
  }, []);
  return null;
}
