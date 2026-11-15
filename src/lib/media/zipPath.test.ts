import { describe, expect, it } from 'vitest';
import { buildPhotoZipEntry, dedupeFileName, photoDateOf } from './zipPath';

describe('photoDateOf', () => {
  it('优先使用 EXIF 拍摄时间', () => {
    expect(photoDateOf({ captured_at: '2026-03-05T18:20', created_at: '2026-11-08T10:00:00.000Z' })).toBe('2026-03-05');
  });

  it('没有拍摄时间时回退上传时间', () => {
    expect(photoDateOf({ captured_at: null, created_at: '2026-11-08T10:00:00.000Z' })).toBe('2026-11-08');
  });

  it('两者都非法时返回空串', () => {
    expect(photoDateOf({ captured_at: '', created_at: 'not-a-date' })).toBe('');
  });
});

describe('buildPhotoZipEntry', () => {
  it('按月分目录并加日期前缀', () => {
    const entry = buildPhotoZipEntry({
      id: 'm1',
      file_name: '微信图片_1.png',
      captured_at: '2026-11-08T07:30',
      created_at: '2026-11-08T23:00:00.000Z',
    });
    expect(entry).toEqual({ dir: '2026-11', fileName: '20261108_微信图片_1.png', undated: false });
  });

  it('回退上传时间', () => {
    const entry = buildPhotoZipEntry({
      id: 'm2',
      file_name: 'a.jpg',
      captured_at: null,
      created_at: '2026-01-02T03:04:05.000Z',
    });
    expect(entry.dir).toBe('2026-01');
    expect(entry.fileName).toBe('20260102_a.jpg');
  });

  it('无日期时归入未知日期', () => {
    const entry = buildPhotoZipEntry({ id: 'm3', file_name: '', captured_at: null, created_at: '' });
    expect(entry).toEqual({ dir: '未知日期', fileName: 'm3.jpg', undated: true });
  });
});

describe('dedupeFileName', () => {
  it('同名时追加数字后缀', () => {
    const seen = new Set<string>();
    const a = dedupeFileName('2026-11', 'a.jpg', seen);
    seen.add(a);
    const b = dedupeFileName('2026-11', 'a.jpg', seen);
    seen.add(b);
    const c = dedupeFileName('2026-11', 'a.jpg', seen);
    expect(a).toBe('2026-11/a.jpg');
    expect(b).toBe('2026-11/a_1.jpg');
    expect(c).toBe('2026-11/a_2.jpg');
  });

  it('不同目录互不影响', () => {
    const seen = new Set<string>(['2026-11/a.jpg']);
    expect(dedupeFileName('2026-12', 'a.jpg', seen)).toBe('2026-12/a.jpg');
  });
});
