import { createHash } from 'node:crypto';

import type { PackContent } from './pack-layout';

/** JSON with object keys sorted, so equal content always serialises the same. */
function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`);
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value);
}

export function contentChecksum(content: PackContent): string {
  return `sha256:${createHash('sha256').update(canonicalJson(content)).digest('hex')}`;
}
