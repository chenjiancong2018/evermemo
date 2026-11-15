import { NextResponse } from 'next/server';
import { Readable } from 'node:stream';
import { apiHandler, requireUser, fail } from '@/lib/api/http';
import { listEntries } from '@/lib/db/entries';
import { buildReportPdf } from '@/lib/pdf/buildPdf';

export const GET = apiHandler(async (req) => {
  const user = await requireUser();
  const url = new URL(req.url);
  const from = url.searchParams.get('from') ?? '';
  const to = url.searchParams.get('to') ?? '';
  const title = (url.searchParams.get('title') ?? '').trim().slice(0, 100) || '回顾报告';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return fail(400, 'VALIDATION', '日期格式不正确');
  }
  const result = await listEntries(user.id, { page: 1, page_size: 100, from, to });
  const all = result.items;
  for (let p = 2; p <= 10 && result.has_more; p++) {
    const more = await listEntries(user.id, { page: p, page_size: 100, from, to });
    all.push(...more.items);
    result.has_more = more.has_more;
  }
  const pdf = await buildReportPdf({ title, from, to, entries: all, userName: user.display_name });
  return new NextResponse(Readable.from(pdf) as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="evermemo-report-${from.replaceAll('-', '')}-${to.replaceAll('-', '')}.pdf"`,
    },
  });
});
