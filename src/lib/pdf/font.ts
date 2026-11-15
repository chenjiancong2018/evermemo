import fs from 'node:fs';
import PDFDocument from 'pdfkit';

/**
 * 注册系统中文字体（优先微软雅黑，其次黑体）。
 * 返回注册名；找不到字体时抛错（调用方应给出友好提示）。
 */
export function registerChineseFont(doc: InstanceType<typeof PDFDocument>): string {
  const candidates: Array<{ path: string; ps: string; name: string }> = [
    { path: 'C:/Windows/Fonts/msyh.ttc', ps: 'MicrosoftYaHei', name: 'yh' },
    { path: 'C:/Windows/Fonts/simhei.ttf', ps: 'SimHei', name: 'yh' },
    { path: '/System/Library/Fonts/PingFang.ttc', ps: 'PingFangSC-Regular', name: 'yh' },
    { path: '/usr/share/fonts/truetype/wqy/wqy-microhei.ttc', ps: 'WenQuanYiMicroHei', name: 'yh' },
  ];
  for (const c of candidates) {
    try {
      if (!fs.existsSync(c.path)) continue;
      doc.registerFont(c.name, c.path, c.ps);
      return c.name;
    } catch {
      /* try next */
    }
  }
  throw new Error('未找到可用的中文字体（msyh.ttc / simhei.ttf），无法生成 PDF');
}
