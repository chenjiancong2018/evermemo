import PDFDocument from 'pdfkit';
import { PassThrough } from 'node:stream';
import { registerChineseFont } from './font';
import { computeReport } from './reportData';
import { ENTRY_TYPE_LABELS, type EntryWithMeta } from '@/lib/types';
import { formatDateCN } from '@/lib/utils';

/** 收集 PDFDocument 输出为 Buffer（pdfkit 0.20 data 事件不触发，须走 pipe） */
function collectPdf(doc: InstanceType<typeof PDFDocument>): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const pass = new PassThrough();
    const chunks: Buffer[] = [];
    pass.on('data', (c: Buffer) => chunks.push(c));
    pass.on('end', () => resolve(Buffer.concat(chunks)));
    pass.on('error', reject);
    doc.pipe(pass);
    doc.end();
  });
}

const ACCENT = '#777D66';
const INK = '#252525';
const MUTED = '#858585';
const BORDER = '#EAE8E1';

/** 纪念册里的一张照片（文件已由调用方读入） */
export interface AlbumPhoto {
  buffer: Buffer;
  /** YYYY-MM-DD */
  date: string;
  caption: string;
}

/** 照片墙：每页 2 列 × 适配高度，图片 contain 到格子内 */
function drawPhotoWall(
  doc: InstanceType<typeof PDFDocument>,
  font: string,
  photos: AlbumPhoto[]
): void {
  if (!photos.length) return;
  if (doc.y > doc.page.height - 200) doc.addPage();
  doc.font(font).fontSize(16).fillColor(INK).text('照片墙', 48, doc.y);
  doc.moveDown(0.6);

  const gap = 16;
  const cellW = (doc.page.width - 96 - gap) / 2;
  const cellH = 150;
  const capH = 26;
  let col = 0;
  let rowTop = doc.y;

  for (const p of photos) {
    if (rowTop + cellH + capH > doc.page.height - 48) {
      doc.addPage();
      rowTop = 48;
      col = 0;
    }
    const x = 48 + col * (cellW + gap);
    try {
      doc.image(p.buffer, x, rowTop, { fit: [cellW, cellH], align: 'center', valign: 'center' });
    } catch {
      // 损坏的图片静默跳过，不影响整本纪念册
    }
    doc
      .font(font)
      .fontSize(8.5)
      .fillColor(MUTED)
      .text(`${formatDateCN(p.date)}${p.caption ? ' · ' + p.caption : ''}`, x, rowTop + cellH + 4, {
        width: cellW,
        height: capH,
        ellipsis: true,
      });
    col += 1;
    if (col === 2) {
      col = 0;
      rowTop += cellH + capH;
    }
  }
  doc.y = rowTop + (col === 0 ? 0 : cellH + capH);
  doc.moveDown(1);
}

function escapeTitle(s: string): string {
  return s.replace(/[<>]/g, '');
}

/** 生成回顾报告 PDF，返回 Buffer */
export function buildReportPdf(opts: {
  title: string;
  from: string;
  to: string;
  entries: EntryWithMeta[];
  userName: string;
}): Promise<Buffer> {
  const data = computeReport(opts.entries);
  const doc = new PDFDocument({ size: 'A4', margin: 48, info: { Title: opts.title || '回顾报告' } });
  const font = registerChineseFont(doc);

  // 封面
  doc.font(font).fontSize(22).fillColor(ACCENT).text('Evermemo', { align: 'center' });
  doc.moveDown(0.4).fontSize(20).fillColor(INK).text(escapeTitle(opts.title || '回顾报告'), { align: 'center' });
  doc.moveDown(0.3).fontSize(11).fillColor(MUTED).text(`${formatDateCN(opts.from)} — ${formatDateCN(opts.to)}`, { align: 'center' });
  doc.moveDown(1.5).fontSize(11).fillColor(MUTED).text(`属于 ${opts.userName} 的人生切片 · 生成于 ${formatDateCN(new Date().toISOString().slice(0, 10))}`, { align: 'center' });
  doc.addPage();

  // 概览
  doc.font(font).fontSize(16).fillColor(INK).text('概览');
  doc.moveDown(0.5).fontSize(10.5).fillColor(MUTED).text('记录 · 照片 · 收藏 · 重要');
  const stats = [
    { v: data.total, l: '条记录' },
    { v: data.photos, l: '张照片' },
    { v: data.favorites, l: '条收藏' },
    { v: data.important, l: '条重要' },
    { v: data.activeDays, l: '个活跃日' },
    { v: data.longestStreak, l: '天最长连续' },
  ];
  const colW = (doc.page.width - 96) / 3;
  let x = 48;
  let y = doc.y + 6;
  stats.forEach((s, i) => {
    if (i > 0 && i % 3 === 0) {
      y += 44;
      x = 48;
    }
    doc.font(font).fontSize(22).fillColor(ACCENT).text(String(s.v), x, y, { width: colW, align: 'left' });
    doc.font(font).fontSize(9.5).fillColor(MUTED).text(s.l, x, y + 24, { width: colW });
    x += colW;
  });
  doc.moveDown(3.4);

  // 月度足迹
  if (data.byMonth.length) {
    doc.font(font).fontSize(16).fillColor(INK).text('月度足迹');
    doc.moveDown(0.4);
    const max = Math.max(...data.byMonth.map((m) => m.count));
    for (const m of data.byMonth) {
      const w = Math.max(12, ((m.count / max) * (doc.page.width - 96 - 140)));
      doc.font(font).fontSize(10).fillColor(INK).text(m.month, 48, doc.y, { width: 60 });
      doc.roundedRect(116, doc.y + 1, w, 10, 3).fill(ACCENT);
      doc.font(font).fontSize(10).fillColor(MUTED).text(String(m.count), 124 + w, doc.y, { width: 60 });
      doc.moveDown(0.85);
    }
    doc.moveDown(1);
  }

  // 类型与心情
  const half = (doc.page.width - 96 - 24) / 2;
  const leftTop = doc.y;
  doc.font(font).fontSize(13).fillColor(INK).text('记录类型', 48, leftTop);
  doc.y = leftTop + 20;
  for (const t of data.byType) {
    doc.font(font).fontSize(10).fillColor(INK).text(`${ENTRY_TYPE_LABELS[t.type as keyof typeof ENTRY_TYPE_LABELS] ?? t.type}`, 48, doc.y, { width: half - 30 });
    doc.font(font).fontSize(10).fillColor(MUTED).text(`${t.count} 条`, 48 + half - 40, doc.y - 12, { width: 40, align: 'right' });
  }
  let rightTop = leftTop;
  doc.font(font).fontSize(13).fillColor(INK).text('心情分布', 48 + half + 24, rightTop);
  rightTop += 20;
  for (const m of data.byMood) {
    doc.font(font).fontSize(10).fillColor(INK).text(m.mood, 48 + half + 24, rightTop, { width: half - 30 });
    doc.font(font).fontSize(10).fillColor(MUTED).text(`${m.count} 条`, 48 + half + 24 + half - 40, rightTop, { width: 40, align: 'right' });
    rightTop += 14;
  }
  doc.y = Math.max(leftTop + 20 + data.byType.length * 14, rightTop) + 24;

  // 高频标签
  if (data.byTag.length) {
    doc.font(font).fontSize(16).fillColor(INK).text('高频标签');
    doc.moveDown(0.4).fontSize(10).fillColor(INK);
    const tagLine = data.byTag.map((t) => `${t.tag}(${t.count})`).join('  ');
    doc.text(tagLine);
    doc.moveDown(1);
  }

  // 高光时刻
  const highlights = opts.entries
    .filter((e) => e.is_important || e.is_favorite)
    .slice(0, 10);
  if (highlights.length) {
    doc.font(font).fontSize(16).fillColor(INK).text('高光时刻');
    for (const h of highlights) {
      doc.moveDown(0.5);
      const badge = [h.is_important ? '重要' : '', h.is_favorite ? '收藏' : ''].filter(Boolean).join(' · ');
      doc.font(font).fontSize(10).fillColor(ACCENT).text(`${formatDateCN(h.occurred_at.slice(0, 10))}${badge ? ' · ' + badge : ''} · ${ENTRY_TYPE_LABELS[h.entry_type as keyof typeof ENTRY_TYPE_LABELS] ?? h.entry_type}`);
      doc.font(font).fontSize(11).fillColor(INK).text(escapeTitle(h.title || '（无标题）'));
      if (h.content) {
        doc.font(font).fontSize(9.5).fillColor(MUTED).text(h.content.replace(/[#>*`\-\[\]]/g, '').slice(0, 120));
      }
    }
  } else {
    doc.font(font).fontSize(11).fillColor(MUTED).text('这个区间里没有收藏或重要的记录。');
  }

  return collectPdf(doc);
}

/** 生成纪念册 PDF，返回 Buffer */
export function buildAlbumPdf(opts: {
  year: number;
  entries: EntryWithMeta[];
  photoCount: number;
  milestoneCount: number;
  chapterCount: number;
  userName: string;
  /** 可选：照片墙（已在路由层读入文件字节） */
  photos?: AlbumPhoto[];
}): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'A4', margin: 48, info: { Title: `${opts.year} 年度纪念册` } });
  const font = registerChineseFont(doc);

  doc.font(font).fontSize(22).fillColor(ACCENT).text('Evermemo', { align: 'center' });
  doc.moveDown(0.4).fontSize(20).fillColor(INK).text(`${opts.year} 年度纪念册`, { align: 'center' });
  doc.moveDown(0.3).fontSize(11).fillColor(MUTED).text(`属于 ${opts.userName} · 生成于 ${formatDateCN(new Date().toISOString().slice(0, 10))}`, { align: 'center' });
  doc.moveDown(1.5).fontSize(11).fillColor(MUTED).text(
    `${opts.entries.length} 条记录 · ${opts.photoCount} 张照片 · ${opts.milestoneCount} 个重要时刻 · ${opts.chapterCount} 篇故事`,
    { align: 'center' }
  );
  doc.addPage();

  // 照片墙（这一年的照片）
  drawPhotoWall(doc, font, opts.photos ?? []);

  // 按日分组全文
  const groups = new Map<string, EntryWithMeta[]>();
  for (const e of opts.entries) {
    const key = e.occurred_at.slice(0, 10);
    const arr = groups.get(key) ?? [];
    arr.push(e);
    groups.set(key, arr);
  }
  const sortedKeys = Array.from(groups.keys()).sort((a, b) => b.localeCompare(a));
  for (const day of sortedKeys) {
    if (doc.y > doc.page.height - 120) doc.addPage();
    doc.font(font).fontSize(13).fillColor(ACCENT).text(formatDateCN(day));
    doc.moveDown(0.3);
    for (const e of groups.get(day)!) {
      if (doc.y > doc.page.height - 100) doc.addPage();
      const head = `${ENTRY_TYPE_LABELS[e.entry_type as keyof typeof ENTRY_TYPE_LABELS] ?? e.entry_type}${e.mood ? ' · ' + e.mood : ''}`;
      doc.font(font).fontSize(11).fillColor(INK).text(escapeTitle(e.title || '（无标题）'));
      doc.font(font).fontSize(9).fillColor(MUTED).text(head);
      if (e.content) {
        doc.font(font).fontSize(9.5).fillColor(INK).text(e.content.replace(/[#>*`\-\[\]]/g, '').slice(0, 500), { lineGap: 2 });
      }
      if (e.tags.length) {
        doc.font(font).fontSize(9).fillColor(MUTED).text(e.tags.map((t) => '#' + t.name).join(' '));
      }
      doc.moveDown(0.8);
    }
  }
  if (!sortedKeys.length) {
    doc.font(font).fontSize(11).fillColor(MUTED).text('这一年还没有记录。');
  }

  return collectPdf(doc);
}
