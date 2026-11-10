import type { RuleName } from './refusal';

/** The largest Illustration taken, in bytes: 150 KB (ADR 0055). */
export const MAX_ILLUSTRATION_BYTES = 150_000;

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** Why an Illustration file would break on the card, by the rule it breaks. */
export interface IllustrationRefusal {
  readonly rule: Extract<RuleName, `illustration-${string}`>;
  readonly message: string;
}

/**
 * The rules an Illustration file breaks (ADR 0055, 0099): it is not a PNG,
 * is over 150 KB or is not square. A file that is not a PNG is refused for
 * that alone; a PNG both too large and not square gets both refusals.
 */
export function illustrationRefusals(bytes: Uint8Array): IllustrationRefusal[] {
  const size = pngSize(bytes);
  if (size === undefined) return [{ rule: 'illustration-png', message: 'The file is not a PNG' }];
  return [
    ...(bytes.byteLength > MAX_ILLUSTRATION_BYTES
      ? [
          {
            rule: 'illustration-size' as const,
            message: `The file is ${String(bytes.byteLength)} bytes, over the 150 KB (${String(MAX_ILLUSTRATION_BYTES)} bytes) limit`,
          },
        ]
      : []),
    ...(size.width === size.height
      ? []
      : [
          {
            rule: 'illustration-square' as const,
            message: `The picture is ${String(size.width)}×${String(size.height)} px, not square`,
          },
        ]),
  ];
}

/** The width and height in a PNG's header, or undefined when the bytes are not a PNG. */
function pngSize(bytes: Uint8Array): { width: number; height: number } | undefined {
  if (bytes.byteLength < 24) return undefined;
  if (PNG_SIGNATURE.some((byte, index) => bytes[index] !== byte)) return undefined;
  if (new TextDecoder('latin1').decode(bytes.subarray(12, 16)) !== 'IHDR') return undefined;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}
