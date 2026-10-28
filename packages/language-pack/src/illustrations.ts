import { existsSync, readFileSync } from 'node:fs';

import type { Word } from '@slovo/contracts';

import type { BuildError } from './build-error';
import type { Authored } from './check-content';
import { ILLUSTRATIONS_DIR } from './edition-folder';

/** The largest Illustration the build takes, in bytes: 150 KB (ADR 0055). */
export const MAX_ILLUSTRATION_BYTES = 150_000;

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/**
 * The Words whose Illustration would break on the card: its file is
 * missing, is not a PNG, is over 150 KB or is not square (ADR 0055). Each
 * refusal names the Word and the reason; a file both too large and not
 * square gets both.
 */
export function illustrationErrors(
  words: readonly Authored<Word>[],
  pathOf: (name: string) => string,
): BuildError[] {
  return words.flatMap(({ file, entry }) => {
    const name = entry.illustration;
    if (name === undefined) return [];
    const refuse = (message: string): BuildError => ({
      file,
      entryId: entry.id,
      field: 'illustration',
      message,
    });
    const path = pathOf(name);
    if (!existsSync(path)) return [refuse(`No file ${name} in ${ILLUSTRATIONS_DIR}/`)];
    const shown = `${ILLUSTRATIONS_DIR}/${name}`;
    const bytes = readFileSync(path);
    const size = pngSize(bytes);
    if (!name.endsWith('.png') || size === undefined) return [refuse(`${shown} is not a PNG`)];
    return [
      ...(bytes.length > MAX_ILLUSTRATION_BYTES
        ? [
            refuse(
              `${shown} is ${String(bytes.length)} bytes, over the 150 KB (${String(MAX_ILLUSTRATION_BYTES)} bytes) limit`,
            ),
          ]
        : []),
      ...(size.width === size.height
        ? []
        : [refuse(`${shown} is ${String(size.width)}×${String(size.height)} px, not square`)]),
    ];
  });
}

/** The width and height in a PNG's header, or undefined when the bytes are not a PNG. */
function pngSize(bytes: Buffer): { width: number; height: number } | undefined {
  if (bytes.length < 24) return undefined;
  if (!bytes.subarray(0, 8).equals(PNG_SIGNATURE)) return undefined;
  if (bytes.toString('latin1', 12, 16) !== 'IHDR') return undefined;
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}
