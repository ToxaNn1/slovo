import { readFileSync } from 'node:fs';

import { createContentUpdate, loadEdition, type Edition, type PackVersion } from '@slovo/core';
import {
  createFakeBackend,
  createMemoryPackFiles,
  type MemoryPackFile,
  seedUserState,
} from '@slovo/core/testing';
import { PACK_FORMAT } from '@slovo/language-pack/reader';
import { describe, expect, it } from 'vitest';

import { createNativeModules } from '../device/native-module';
import { fakeClock, ukrainian, ukrainianFolder } from '../test-support';
import { openLaunchPack, type ContentUpdates } from './launch-pack';

const bytesOf = (text: string) => Uint8Array.from(text, (character) => character.charCodeAt(0));

/** The UA Edition with its `contentUpdates` Feature Switch off. */
function withContentUpdatesOff(): Edition {
  const config = JSON.parse(readFileSync(ukrainianFolder.path('config'), 'utf8')) as {
    featureSwitches: Record<string, boolean>;
  };
  return loadEdition({
    ...config,
    featureSwitches: { ...config.featureSwitches, contentUpdates: false },
  });
}

/**
 * The app on a device across launches: its bundled pack, the backend, and the
 * device's pack files and user state, which a launch finds as the one before
 * left them. The readers it opens are named by what they read.
 */
function device({
  bundled = { contentVersion: 4, packFormat: PACK_FORMAT },
  kept,
}: { bundled?: PackVersion; kept?: MemoryPackFile } = {}) {
  const contentApi = createFakeBackend();
  const packFiles = createMemoryPackFiles(kept);
  const userState = seedUserState();
  const { clock } = fakeClock();
  const closed: string[] = [];
  const errors: unknown[] = [];
  /** Kept packs the app refuses to open, as one of another Edition. */
  const refused = new Set<number>();

  const contentUpdates: ContentUpdates<string> = {
    openKeptPack: ({ contentVersion }) =>
      refused.has(contentVersion)
        ? Promise.reject(new Error('The app mixes Editions'))
        : Promise.resolve(`kept ${String(contentVersion)}`),
    async open(bundledVersion) {
      return createContentUpdate({
        backend: contentApi.backend,
        edition: { id: 'uk' },
        packFiles,
        userState: await userState,
        clock,
        random: { next: () => 0.5 },
        schedule: (run) => {
          run();
          return () => undefined;
        },
        bundled: bundledVersion,
        readableFormats: [PACK_FORMAT],
      });
    },
  };

  return {
    contentApi,
    packFiles,
    contentUpdates,
    closed,
    errors,
    refuse(contentVersion: number) {
      refused.add(contentVersion);
    },
    /** Launches the app; `onDevice` replaces what content updates have on the device, undefined included. */
    launch(options: { edition?: Edition; onDevice?: ContentUpdates<string> | undefined } = {}) {
      return openLaunchPack({
        edition: options.edition ?? ukrainian,
        contentUpdates: 'onDevice' in options ? options.onDevice : contentUpdates,
        openBundled: () =>
          Promise.resolve({
            reader: `bundled ${String(bundled.contentVersion)}`,
            version: bundled,
            close() {
              closed.push('bundled');
              return Promise.resolve();
            },
          }),
        onError(error) {
          errors.push(error);
        },
      });
    },
  };
}

const newerKept: MemoryPackFile = {
  contentVersion: 5,
  packFormat: PACK_FORMAT,
  bytes: bytesOf('pack 5'),
};

describe('the Language Pack the app opens at launch', () => {
  it('opens the bundled pack with content updates off on a client without the file-system module', async () => {
    const app = device({ kept: newerKept });
    const nativeModules = createNativeModules({
      notifications: () => true,
      timePicker: () => true,
      widget: () => false,
      shareCapture: () => false,
      contentUpdates: () => false,
      keychain: () => false,
      googleSignIn: () => false,
      appleSignIn: () => false,
      application: () => false,
      updates: () => false,
      spotlight: () => false,
    });

    const launched = await app.launch({
      onDevice: nativeModules.load('contentUpdates', () => app.contentUpdates),
    });

    expect(launched).toEqual({
      reader: 'bundled 4',
      version: { contentVersion: 4, packFormat: PACK_FORMAT },
      contentUpdate: undefined,
    });
    expect(app.packFiles.kept).toEqual(newerKept);
  });

  it('opens the bundled pack with content updates off when the Edition switches them off', async () => {
    const app = device({ kept: newerKept });

    const launched = await app.launch({ edition: withContentUpdatesOff() });

    expect(launched).toEqual({
      reader: 'bundled 4',
      version: { contentVersion: 4, packFormat: PACK_FORMAT },
      contentUpdate: undefined,
    });
    expect(app.packFiles.kept).toEqual(newerKept);
  });

  it('opens the bundled pack, with content updates on, when no pack is kept', async () => {
    const app = device();

    const { reader, version, contentUpdate } = await app.launch();

    expect(reader).toBe('bundled 4');
    expect(version).toEqual({ contentVersion: 4, packFormat: PACK_FORMAT });
    expect(contentUpdate).toBeDefined();
    expect(app.closed).toEqual([]);
  });

  it('opens the kept pack when it is newer than the bundled one, and closes the bundled one', async () => {
    const app = device({ kept: newerKept });

    const { reader, version } = await app.launch();

    expect(reader).toBe('kept 5');
    expect(version).toEqual({ contentVersion: 5, packFormat: PACK_FORMAT });
    expect(app.closed).toEqual(['bundled']);
  });

  it('opens the bundled pack and forgets the kept one when an App Store update bundles newer content', async () => {
    const app = device({
      bundled: { contentVersion: 6, packFormat: PACK_FORMAT },
      kept: newerKept,
    });

    const { reader } = await app.launch();

    expect(reader).toBe('bundled 6');
    expect(app.packFiles.kept).toBeUndefined();
  });

  it('opens the bundled pack and forgets a kept pack it refuses, such as one of another Edition', async () => {
    const app = device({ kept: newerKept });
    app.refuse(5);

    const { reader, contentUpdate } = await app.launch();

    expect(reader).toBe('bundled 4');
    expect(contentUpdate).toBeDefined();
    expect(app.packFiles.kept).toBeUndefined();
    expect(app.closed).toEqual([]);
    expect(app.errors).toHaveLength(1);
  });

  it('opens the bundled pack with content updates off when they fail to open', async () => {
    const app = device();
    const failing: ContentUpdates<string> = {
      ...app.contentUpdates,
      open: () => Promise.reject(new Error('The app does not read the pack format 2')),
    };

    const launched = await app.launch({ onDevice: failing });

    expect(launched).toEqual({
      reader: 'bundled 4',
      version: { contentVersion: 4, packFormat: PACK_FORMAT },
      contentUpdate: undefined,
    });
    expect(app.errors).toHaveLength(1);
  });

  it('asks the backend for the newest pack of format 9, the one the app reads', async () => {
    const app = device();

    const { contentUpdate } = await app.launch();
    await contentUpdate?.checkForUpdate();

    expect(app.contentApi.content.asked).toEqual([9]);
  });

  it('opens a pack downloaded in one run from the next launch, never in the run that kept it', async () => {
    const app = device();
    app.contentApi.content.publish({
      contentVersion: 5,
      packFormat: PACK_FORMAT,
      bytes: bytesOf('pack 5'),
    });

    const first = await app.launch();
    await first.contentUpdate?.checkForUpdate();

    expect(first.reader).toBe('bundled 4');
    expect(app.packFiles.kept?.contentVersion).toBe(5);
    expect((await app.launch()).reader).toBe('kept 5');
  });
});
