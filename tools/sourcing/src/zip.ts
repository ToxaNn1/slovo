/**
 * Reads one file out of a zip archive (a `.jar` or a `.whl`), stored or
 * deflated: the dictionary files `source:lemmas` downloads come packed so.
 */
import { inflateRawSync } from 'node:zlib';

const END_OF_DIRECTORY = 0x06054b50;
const DIRECTORY_ENTRY = 0x02014b50;
const LOCAL_HEADER = 0x04034b50;

/** The bytes of the entry `name`; throws when the archive has none. */
export function readZipEntry(archive: Uint8Array, name: string): Uint8Array {
  const view = Buffer.from(archive.buffer, archive.byteOffset, archive.byteLength);
  let end = view.length - 22;
  while (end >= 0 && view.readUInt32LE(end) !== END_OF_DIRECTORY) end -= 1;
  if (end < 0) throw new Error('Not a zip archive: no end of central directory');
  const entries = view.readUInt16LE(end + 10);
  let at = view.readUInt32LE(end + 16);
  for (let index = 0; index < entries; index += 1) {
    if (view.readUInt32LE(at) !== DIRECTORY_ENTRY) throw new Error('Broken zip central directory');
    const method = view.readUInt16LE(at + 10);
    const size = view.readUInt32LE(at + 20);
    const nameLength = view.readUInt16LE(at + 28);
    const skip = nameLength + view.readUInt16LE(at + 30) + view.readUInt16LE(at + 32);
    const local = view.readUInt32LE(at + 42);
    if (view.toString('utf8', at + 46, at + 46 + nameLength) === name) {
      if (view.readUInt32LE(local) !== LOCAL_HEADER) throw new Error(`Broken zip entry ${name}`);
      const start = local + 30 + view.readUInt16LE(local + 26) + view.readUInt16LE(local + 28);
      const body = view.subarray(start, start + size);
      if (method === 0) return Uint8Array.from(body);
      if (method === 8) return inflateRawSync(body);
      throw new Error(`Zip entry ${name} uses compression method ${String(method)}`);
    }
    at += 46 + skip;
  }
  throw new Error(`The zip archive has no entry ${name}`);
}
