import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/api/http';
import { exportAllData } from '@/lib/api/export';

/** 全量 JSON 导出下载 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const user = await requireUser();
  const json = exportAllData(user);
  const date = new Date().toISOString().slice(0, 10).replaceAll('-', '');
  return new NextResponse(json, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="evermemo-export-${date}.json"`,
    },
  });
}
