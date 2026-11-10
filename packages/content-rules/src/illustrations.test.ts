import { describe, expect, it } from 'vitest';

import { MAX_ILLUSTRATION_BYTES, illustrationRefusals } from './index';

/** A PNG's signature and IHDR header for the size, padded to the length in bytes. */
function png(width: number, height: number, length = 64): Uint8Array {
  const bytes = new Uint8Array(length);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  bytes.set([0, 0, 0, 13], 8);
  bytes.set(new TextEncoder().encode('IHDR'), 12);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return bytes;
}

const rulesOf = (bytes: Uint8Array) => illustrationRefusals(bytes).map(({ rule }) => rule);

describe('the Illustration rules (ADR 0055)', () => {
  it('takes a square PNG of at most 150 KB', () => {
    expect(illustrationRefusals(png(512, 512, MAX_ILLUSTRATION_BYTES))).toEqual([]);
  });

  it('refuses a file that is not a PNG, and checks nothing else of it', () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, ...Array.from({ length: 60 }, () => 0)]);
    expect(illustrationRefusals(jpeg)).toEqual([
      { rule: 'illustration-png', message: 'The file is not a PNG' },
    ]);
    expect(rulesOf(new Uint8Array())).toEqual(['illustration-png']);
  });

  it('refuses a PNG of 151 KB, naming its size and the limit', () => {
    expect(illustrationRefusals(png(512, 512, 151_000))).toEqual([
      {
        rule: 'illustration-size',
        message: 'The file is 151000 bytes, over the 150 KB (150000 bytes) limit',
      },
    ]);
  });

  it('refuses a PNG that is not square, naming its size', () => {
    expect(illustrationRefusals(png(640, 480))).toEqual([
      { rule: 'illustration-square', message: 'The picture is 640×480 px, not square' },
    ]);
  });

  it('names both rules for a PNG too large and not square', () => {
    expect(rulesOf(png(640, 480, 200_000))).toEqual(['illustration-size', 'illustration-square']);
  });
});
