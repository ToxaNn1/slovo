/**
 * The most changes one push of Sync sends, and the most records one pull
 * answers (spec #378). The app's Core pushes its pending changes in batches
 * of this size.
 */
export const SYNC_BATCH_SIZE = 500;

/**
 * The limits of one record of Sync, in the one place the backend, the device
 * and the contract's description read them from (ADR 0208). A push with a
 * change over any of them is refused whole, so a device sends none.
 */
export const SYNC_RECORD_LIMITS = {
  /** The most characters of a record's key, each code point one. */
  keyLength: 200,
  /** The most bytes of a record's value as compact JSON in UTF-8: 8 KB. */
  valueBytes: 8 * 1024,
  /** The most levels of arrays and objects a record's value nests. */
  valueDepth: 32,
} as const;

/** How many bytes the text takes in UTF-8, a lone surrogate counted as the three of its replacement. */
export function utf8Bytes(text: string): number {
  let bytes = 0;
  for (const character of text) {
    const codePoint = character.codePointAt(0) ?? 0;
    bytes += codePoint < 0x80 ? 1 : codePoint < 0x800 ? 2 : codePoint < 0x10000 ? 3 : 4;
  }
  return bytes;
}

/**
 * How many levels of arrays and objects the value nests, with a loop rather
 * than recursion, so a value of any depth is counted on a fixed stack.
 */
export function depthOf(value: unknown): number {
  let deepest = 0;
  const open: { readonly node: unknown; readonly depth: number }[] = [{ node: value, depth: 0 }];
  for (let next = open.pop(); next !== undefined; next = open.pop()) {
    const { node, depth } = next;
    if (typeof node !== 'object' || node === null) continue;
    deepest = Math.max(deepest, depth + 1);
    for (const child of Object.values(node)) open.push({ node: child, depth: depth + 1 });
  }
  return deepest;
}

/** Whether a change of a record is within `SYNC_RECORD_LIMITS`: its key, and its value as JSON, `null` for a tombstone. */
export function fitsSyncRecord({
  key,
  value,
}: {
  readonly key: string;
  readonly value: unknown;
}): boolean {
  return (
    Array.from(key).length <= SYNC_RECORD_LIMITS.keyLength &&
    depthOf(value) <= SYNC_RECORD_LIMITS.valueDepth &&
    utf8Bytes(JSON.stringify(value)) <= SYNC_RECORD_LIMITS.valueBytes
  );
}
