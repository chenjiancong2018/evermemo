'use client';

import { Printer } from 'lucide-react';

/** 打印/导出 PDF 按钮（客户端组件，服务端页面里调用 window.print 需要它） */
export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs text-white hover:opacity-90"
    >
      <Printer size={13} /> 打印 / 导出 PDF
    </button>
  );
}
