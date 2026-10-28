/** The `name` table ids of a font's typographic family and, when it has none, its family. */
const TYPOGRAPHIC_FAMILY = 16;
const FAMILY = 1;

/**
 * The family a TrueType or OpenType font belongs to, read from the Windows
 * Unicode records of its `name` table: the name iOS knows the embedded font
 * by. Undefined when the bytes hold no such name.
 */
export function readFontFamily(font: Buffer): string | undefined {
  try {
    let table: number | undefined;
    for (let index = 0; index < font.readUInt16BE(4); index++) {
      const record = 12 + 16 * index;
      if (font.toString('latin1', record, record + 4) === 'name')
        table = font.readUInt32BE(record + 8);
    }
    if (table === undefined) return undefined;
    const strings = table + font.readUInt16BE(table + 4);
    const names = new Map<number, string>();
    for (let index = 0; index < font.readUInt16BE(table + 2); index++) {
      const record = table + 6 + 12 * index;
      const isWindowsUnicode =
        font.readUInt16BE(record) === 3 && font.readUInt16BE(record + 2) === 1;
      if (!isWindowsUnicode) continue;
      const start = strings + font.readUInt16BE(record + 10);
      const utf16 = Buffer.from(font.subarray(start, start + font.readUInt16BE(record + 8)));
      names.set(font.readUInt16BE(record + 6), utf16.swap16().toString('utf16le'));
    }
    return names.get(TYPOGRAPHIC_FAMILY) ?? names.get(FAMILY);
  } catch (error) {
    // A file too short for the tables it names is not a font.
    if (error instanceof RangeError) return undefined;
    throw error;
  }
}
