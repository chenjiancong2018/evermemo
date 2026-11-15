/**
 * 极简 EXIF 解析：仅提取拍摄时间（DateTimeOriginal 0x9003 / DateTime 0x0132）。
 * 无第三方依赖，只读 ASCII 字段。
 */
export function parseExifDateTime(buf: Buffer): string | null {
  try {
    if (buf.length < 14) return null;
    let little: boolean;
    if (buf.readUInt16BE(0) === 0x4d4d) little = false; // MM
    else if (buf.readUInt16LE(0) === 0x4949) little = true; // II
    else return null;

    const u16 = (o: number) => (little ? buf.readUInt16LE(o) : buf.readUInt16BE(o));
    const u32 = (o: number) => (little ? buf.readUInt32LE(o) : buf.readUInt32BE(o));
    const ascii = (valueOffset: number, count: number): string | null => {
      if (count <= 0 || valueOffset + count > buf.length) return null;
      return buf.toString('ascii', valueOffset, valueOffset + count).split('\0')[0] || null;
    };

    const readIfd = (base: number): { datetime: string | null; exifIfd: number | null } => {
      let datetime: string | null = null;
      let exifIfd: number | null = null;
      const count = u16(base);
      if (count > 256) return { datetime, exifIfd };
      for (let i = 0; i < count; i++) {
        const entry = base + 2 + i * 12;
        const tag = u16(entry);
        const type = u16(entry + 2);
        const cnt = u32(entry + 4);
        const valueBytes = type === 2 ? cnt : cnt * 4; // ASCII 特判
        const inline = valueBytes <= 4;
        const valueOffset = inline ? entry + 8 : u32(entry + 8);
        if (tag === 0x0132 && type === 2) {
          datetime = ascii(inline ? entry + 8 : u32(entry + 8), cnt) ?? datetime;
        } else if (tag === 0x9003 && type === 2) {
          datetime = ascii(inline ? entry + 8 : u32(entry + 8), cnt) ?? datetime;
        } else if (tag === 0x8769 && type === 4) {
          exifIfd = u32(entry + 8);
        }
      }
      return { datetime, exifIfd };
    };

    const ifd0Offset = u32(4);
    if (ifd0Offset + 2 > buf.length) return null;
    const { datetime, exifIfd } = readIfd(ifd0Offset);
    let result = datetime;
    if (exifIfd && exifIfd + 2 <= buf.length && !result) {
      const sub = readIfd(exifIfd);
      result = sub.datetime;
    }
    if (!result) return null;
    // "YYYY:MM:DD HH:MM:SS" → "YYYY-MM-DDTHH:MM"
    const m = result.match(/^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2})/);
    if (!m) return null;
    return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}`;
  } catch {
    return null;
  }
}
