import { readFileSync } from 'node:fs';

import { createContentUpdate, loadEdition, systemRandom, type Edition } from '@slovo/core';
import { createFakeBackend, createMemoryContentStore } from '@slovo/core/testing';
import { PACK_FORMAT } from '@slovo/language-pack/reader';
import { describe, expect, it } from 'vitest';

import { ukrainian, ukrainianFolder } from '../test-support';
import { openLaunchPack } from './launch-pack';

/** The UA Edition with its `contentUpdates` Feature Switch off. */
function withContentUpdatesOff(): Edition {
  const config = JSON.parse(readFileSync(ukrainianFolder.path('config'), 'utf8')) as {
    featureSwitches: Record<string, string>;
  };
  return loadEdition({
    ...config,
    featureSwitches: { ...config.featureSwitches, contentUpdates: 'off' },
  });
}

/** A pack file on the device: the Edition it is of and its content version. */
interface PackFile {
  readonly editionId: string;
  readonly contentVersion: number;
}

/**
 * The app on a device at launch: the pack bundled with it and the patched pack
 * the run before left, if any. The reader it opens is named by what it reads.
 */
function device({ bundled, patched }: { bundled: number; patched?: PackFile }) {
  let onDevice = patched;
  const closed: string[] = [];
  const errors: unknown[] = [];
  const nameOf = (file: PackFile) => `${file.editionId} v${String(file.contentVersion)}`;
  const launch = (edition: Edition = ukrainian) =>
    openLaunchPack({
      edition,
      bundledVersion: () => Promise.resolve({ contentVersion: bundled, packFormat: PACK_FORMAT }),
      openPatched() {
        const file = onDevice;
        if (file === undefined) return Promise.reject(new Error('No pack'));
        if (file.editionId !== 'uk') return Promise.reject(new Error('Another Edition'));
        return Promise.resolve({
          reader: nameOf(file),
          version: { contentVersion: file.contentVersion, packFormat: PACK_FORMAT },
          store: createMemoryContentStore({ contentVersion: file.contentVersion }),
          close() {
            closed.push(nameOf(file));
            return Promise.resolve();
          },
        });
      },
      replaceWithBundled() {
        onDevice = { editionId: 'uk', contentVersion: bundled };
        return Promise.resolve();
      },
      openContentUpdate: (store) =>
        createContentUpdate({
          backend: createFakeBackend().backend,
          edition,
          store,
          random: systemRandom,
          schedule: () => () => undefined,
          readableFormats: [1],
        }),
      onError(error) {
        errors.push(error);
      },
    });
  return { launch, closed, errors };
}

describe('openLaunchPack', () => {
  it('opens the bundled pack on the first launch', async () => {
    const pack = await device({ bundled: 9 }).launch();

    expect(pack.reader).toBe('uk v9');
    expect(pack.contentVersion()).toBe(9);
  });

  it('keeps the patched pack when it is newer than the bundled one', async () => {
    const pack = await device({
      bundled: 9,
      patched: { editionId: 'uk', contentVersion: 12 },
    }).launch();

    expect(pack.reader).toBe('uk v12');
    expect(pack.contentVersion()).toBe(12);
  });

  it('puts a newer bundled pack over an older patched one, as after an app update', async () => {
    const phone = device({ bundled: 9, patched: { editionId: 'uk', contentVersion: 7 } });

    const pack = await phone.launch();

    expect(pack.reader).toBe('uk v9');
    expect(phone.closed).toEqual(['uk v7']);
  });

  it('puts the bundled pack over a pack of another Edition', async () => {
    const pack = await device({
      bundled: 9,
      patched: { editionId: 'en', contentVersion: 30 },
    }).launch();

    expect(pack.reader).toBe('uk v9');
  });

  it('opens content updates over the open pack while the Edition switches them on', async () => {
    const phone = device({ bundled: 9, patched: { editionId: 'uk', contentVersion: 12 } });

    expect((await phone.launch()).contentUpdate?.contentVersion()).toBe(12);
    expect((await phone.launch(withContentUpdatesOff())).contentUpdate).toBeUndefined();
    expect(phone.errors).toEqual([]);
  });
});
