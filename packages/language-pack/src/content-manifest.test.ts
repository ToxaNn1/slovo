import { describe, expect, it } from 'vitest';

import { checkContentVersion } from './content-manifest';
import type { PackContent } from './pack-layout';

// The rule of ADR 0011: the content version follows the content checksum.

const contentAt = (contentVersion: number, displayName = 'Мовлення'): PackContent => ({
  editionId: 'fixture',
  contentVersion,
  categories: [{ id: 'speech', displayName }],
  correctionCategories: [{ id: 'work', displayName: 'На роботі' }],
  words: [],
  corrections: [],
  idioms: [],
  synonymRows: [],
});

/** The manifest that records the content, as `--record` writes it. */
function recordedManifest(contentVersion: number, displayName?: string) {
  const check = checkContentVersion(contentAt(contentVersion - 1, displayName), {
    contentVersion: contentVersion - 1,
  });
  if (check.recorded) throw new Error('Expected unrecorded content');
  return check.next;
}

describe('checkContentVersion', () => {
  it('takes content its manifest records', () => {
    const manifest = recordedManifest(4);

    expect(checkContentVersion(contentAt(4), manifest)).toEqual({ recorded: true, manifest });
  });

  it('asks for the next version with the checksum of the content at it, once the content changed', () => {
    const manifest = recordedManifest(4);
    const changed = contentAt(4, 'Мова');

    const check = checkContentVersion(changed, manifest);

    expect(check).toMatchObject({
      recorded: false,
      next: { contentVersion: 5 },
      error: {
        file: 'content/manifest.json',
        field: 'contentChecksum',
        message: expect.stringMatching(
          /content changed since content version 4.*pnpm build:pack fixture --record/i,
        ) as string,
      },
    });
    if (check.recorded) return;
    expect(checkContentVersion(contentAt(5, 'Мова'), check.next)).toMatchObject({
      recorded: true,
    });
  });

  it('asks for the next version of content whose manifest records no checksum', () => {
    expect(checkContentVersion(contentAt(3), { contentVersion: 3 })).toMatchObject({
      recorded: false,
      next: {
        contentVersion: 4,
        contentChecksum: expect.stringMatching(/^sha256:[0-9a-f]{64}$/) as string,
      },
      error: { message: expect.stringMatching(/not recorded for content version 3/i) as string },
    });
  });

  it('refuses a checksum copied without raising the version, since the checksum covers it', () => {
    const { contentChecksum } = recordedManifest(5);

    expect(checkContentVersion(contentAt(4), { contentVersion: 4, contentChecksum })).toMatchObject(
      { recorded: false, next: { contentVersion: 5, contentChecksum } },
    );
  });

  it('gives equal content the same checksum, whatever the order of its keys', () => {
    const reordered: PackContent = {
      synonymRows: [],
      idioms: [],
      corrections: [],
      words: [],
      categories: [{ displayName: 'Мовлення', id: 'speech' }],
      correctionCategories: [{ displayName: 'На роботі', id: 'work' }],
      contentVersion: 4,
      editionId: 'fixture',
    };

    expect(checkContentVersion(reordered, recordedManifest(4))).toMatchObject({ recorded: true });
  });
});
