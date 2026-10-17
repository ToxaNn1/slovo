import { describe, expect, it } from 'vitest';

import {
  createContentUpdate,
  createFakeContentApi,
  createMemoryPackFiles,
  createMemoryUserStatePort,
  openUserState,
  type MemoryPackFile,
  type PackVersion,
  type Schedule,
} from './index';
import { fakeClock, randomOf } from './test-support';

const HOUR = 60 * 60 * 1000;

/** The bytes of ASCII text. */
const bytesOf = (text: string) => Uint8Array.from(text, (character) => character.charCodeAt(0));

/** A pack file's bytes, and their SHA-256 worked out apart from the Core (`shasum -a 256`). */
const hello = bytesOf('hello');
const helloSha256 = '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824';

/** Opens a kept pack as the shell would, naming the reader by what it reads. */
const openPack = ({ contentVersion }: PackVersion) =>
  Promise.resolve(`kept ${String(contentVersion)}`);

/**
 * The app at a launch: the bundled pack, the backend and the device's pack
 * files and user state, shared by the launches of one test, so a new launch
 * finds what the one before kept. The disk may be full, and the kept pack's
 * record unreadable.
 */
function device({
  bundled = { contentVersion: 4, packFormat: 1 },
  kept,
  readableFormats = [bundled.packFormat],
}: {
  bundled?: PackVersion;
  kept?: MemoryPackFile;
  readableFormats?: readonly number[];
} = {}) {
  const contentApi = createFakeContentApi();
  const packFiles = createMemoryPackFiles(kept);
  /** Whether keeping a pack fails, as on a full disk. */
  let full = false;
  /** Whether reading the kept pack's version fails. */
  let unreadable = false;
  const records = new Map<string, string>();
  const time = fakeClock();
  /** The delay of each retry, in order; the schedule runs it at once. */
  const delays: number[] = [];
  const schedule: Schedule = (run, delay) => {
    delays.push(delay);
    run();
    return () => undefined;
  };
  return {
    contentApi,
    packFiles,
    time,
    delays,
    diskFull(on: boolean) {
      full = on;
    },
    recordUnreadable(on: boolean) {
      unreadable = on;
    },
    async launch() {
      return createContentUpdate({
        contentApi,
        packFiles: {
          keep: (version, bytes) =>
            full ? Promise.reject(new Error('The disk is full')) : packFiles.keep(version, bytes),
          read: () =>
            unreadable ? Promise.reject(new Error('The record is unreadable')) : packFiles.read(),
          forget: () => packFiles.forget(),
        },
        userState: await openUserState({ port: createMemoryUserStatePort(records) }),
        clock: time.clock,
        random: randomOf(0.5),
        schedule,
        bundled,
        readableFormats,
      });
    },
  };
}

describe('checking for a content update', () => {
  it('keeps a newer pack whose SHA-256 is right, and opens it at the next launch', async () => {
    const app = device();
    app.contentApi.publish({
      contentVersion: 5,
      packFormat: 1,
      bytes: hello,
      fileSha256: helloSha256,
    });

    await (await app.launch()).checkForUpdate();

    expect(app.packFiles.kept).toEqual({ contentVersion: 5, packFormat: 1, bytes: hello });
    expect(await (await app.launch()).openKept(openPack)).toBe('kept 5');
  });

  it('asks for the newest pack of the highest pack format the app reads', async () => {
    const app = device({ bundled: { contentVersion: 4, packFormat: 2 }, readableFormats: [1, 2] });

    await (await app.launch()).checkForUpdate();

    expect(app.contentApi.asked).toEqual([2]);
  });

  it('downloads only a pack newer than the bundled one', async () => {
    const app = device();
    app.contentApi.publish({ contentVersion: 4, packFormat: 1, bytes: hello });

    await (await app.launch()).checkForUpdate();

    expect(app.contentApi.downloaded).toEqual([]);
    expect(app.packFiles.kept).toBeUndefined();
  });

  it('downloads only a pack newer than the kept one', async () => {
    const app = device({ kept: { contentVersion: 6, packFormat: 1, bytes: hello } });
    app.contentApi.publish({ contentVersion: 5, packFormat: 1, bytes: hello });
    app.contentApi.publish({ contentVersion: 6, packFormat: 1, bytes: hello });

    await (await app.launch()).checkForUpdate();

    expect(app.contentApi.downloaded).toEqual([]);
  });

  it('throws a pack with a wrong SHA-256 away and keeps the pack kept before', async () => {
    const kept = { contentVersion: 5, packFormat: 1, bytes: hello };
    const app = device({ kept });
    app.contentApi.publish({
      contentVersion: 6,
      packFormat: 1,
      bytes: bytesOf('hello, tampered'),
      fileSha256: helloSha256,
    });

    await (await app.launch()).checkForUpdate();

    expect(app.contentApi.downloaded).toEqual([6]);
    expect(app.packFiles.kept).toEqual(kept);
  });

  it('checks at most once every 24 hours, also across launches', async () => {
    const app = device();
    const launched = await app.launch();

    await launched.checkForUpdate();
    await launched.checkForUpdate();
    await (await app.launch()).checkForUpdate();
    app.time.advance(24 * HOUR - 1);
    await (await app.launch()).checkForUpdate();
    expect(app.contentApi.asked).toHaveLength(1);

    app.time.advance(1);
    await launched.checkForUpdate();
    expect(app.contentApi.asked).toHaveLength(2);
  });

  it('checks again when the clock was put back before the last check', async () => {
    const app = device();
    await (await app.launch()).checkForUpdate();

    app.time.advance(-HOUR);
    await (await app.launch()).checkForUpdate();

    expect(app.contentApi.asked).toHaveLength(2);
  });

  it('runs one check at a time', async () => {
    const app = device();
    const launched = await app.launch();

    await Promise.all([launched.checkForUpdate(), launched.checkForUpdate()]);

    expect(app.contentApi.asked).toHaveLength(1);
  });
});

describe('a failed check', () => {
  it('tries a request again at most 3 times, backing off with jitter', async () => {
    const app = device();
    app.contentApi.fail('latest', 'offline', 'server-error', 'offline', 'offline');

    await expect((await app.launch()).checkForUpdate()).resolves.toBeUndefined();

    expect(app.contentApi.asked).toHaveLength(4);
    // Between half and all of 1, 2 and 4 s; the random source draws 0.5.
    expect(app.delays).toEqual([750, 1_500, 3_000]);
  });

  it('tries a failed download again', async () => {
    const app = device();
    app.contentApi.publish({ contentVersion: 5, packFormat: 1, bytes: hello });
    app.contentApi.fail('download', 'offline');

    await (await app.launch()).checkForUpdate();

    expect(app.contentApi.downloaded).toEqual([5, 5]);
    expect(app.packFiles.kept?.contentVersion).toBe(5);
  });

  it.each([
    ['finds no such Edition', 'not-found'],
    ['holds the request back', 'too-many-requests'],
    ['answers what the request never expects', 'unexpected'],
  ] as const)('is not tried again when the backend %s', async (_, reason) => {
    const app = device();
    app.contentApi.fail('latest', reason);

    await (await app.launch()).checkForUpdate();

    expect(app.contentApi.asked).toHaveLength(1);
    expect(app.delays).toEqual([]);
  });

  it('waits for the next due check, a day later, also across launches', async () => {
    const app = device();
    app.contentApi.publish({ contentVersion: 5, packFormat: 1, bytes: hello });
    app.contentApi.fail('latest', 'offline', 'offline', 'offline', 'offline');
    await (await app.launch()).checkForUpdate();
    await (await app.launch()).checkForUpdate();
    expect(app.contentApi.asked).toHaveLength(4);
    expect(app.packFiles.kept).toBeUndefined();

    app.time.advance(24 * HOUR);
    await (await app.launch()).checkForUpdate();

    expect(app.contentApi.asked).toHaveLength(5);
    expect(app.packFiles.kept?.contentVersion).toBe(5);
  });

  it('throws nothing when keeping the pack fails, and waits for the next due check', async () => {
    const app = device();
    app.contentApi.publish({ contentVersion: 5, packFormat: 1, bytes: hello });
    const launched = await app.launch();
    app.diskFull(true);

    await expect(launched.checkForUpdate()).resolves.toBeUndefined();
    app.diskFull(false);
    await launched.checkForUpdate();
    expect(app.packFiles.kept).toBeUndefined();

    app.time.advance(24 * HOUR);
    await launched.checkForUpdate();
    expect(app.packFiles.kept?.contentVersion).toBe(5);
  });
});

describe('opening the kept pack at launch', () => {
  it('refuses to open over a bundled pack of a pack format the app does not read', async () => {
    const app = device({ bundled: { contentVersion: 4, packFormat: 2 }, readableFormats: [1] });

    await expect(app.launch()).rejects.toThrow(/pack format 2/);
  });

  it('opens nothing when none is kept, so the bundled pack stays', async () => {
    const app = device();
    const asked: PackVersion[] = [];

    const opened = await (
      await app.launch()
    ).openKept((version) => {
      asked.push(version);
      return openPack(version);
    });

    expect(opened).toBeUndefined();
    expect(asked).toEqual([]);
  });

  it('opens the kept pack of its version when it is newer than the bundled one', async () => {
    const kept = { contentVersion: 5, packFormat: 1, bytes: hello };
    const app = device({ kept });

    expect(await (await app.launch()).openKept(openPack)).toBe('kept 5');
    expect(app.packFiles.kept).toEqual(kept);
  });

  it.each([
    ['older than', 3],
    ['as old as', 4],
  ])('forgets a kept pack %s the bundled one and opens nothing', async (_, version) => {
    const app = device({ kept: { contentVersion: version, packFormat: 1, bytes: hello } });

    expect(await (await app.launch()).openKept(openPack)).toBeUndefined();
    expect(app.packFiles.kept).toBeUndefined();
  });

  it('forgets a kept pack of a pack format the app no longer reads', async () => {
    const app = device({
      bundled: { contentVersion: 4, packFormat: 2 },
      kept: { contentVersion: 9, packFormat: 1, bytes: hello },
    });

    expect(await (await app.launch()).openKept(openPack)).toBeUndefined();
    expect(app.packFiles.kept).toBeUndefined();
  });

  it('forgets a kept pack that fails to open, such as one of another Edition, and rejects', async () => {
    const app = device({ kept: { contentVersion: 5, packFormat: 1, bytes: hello } });

    await expect(
      (await app.launch()).openKept(() => Promise.reject(new Error('The app mixes Editions'))),
    ).rejects.toThrow('The app mixes Editions');
    expect(app.packFiles.kept).toBeUndefined();
  });

  it('forgets a kept pack whose version it fails to read, and rejects', async () => {
    const app = device({ kept: { contentVersion: 5, packFormat: 1, bytes: hello } });
    app.recordUnreadable(true);

    await expect((await app.launch()).openKept(openPack)).rejects.toThrow('unreadable');
    expect(app.packFiles.kept).toBeUndefined();
  });

  it('downloads the pack again at the next due check after forgetting one that failed to open', async () => {
    const app = device({ kept: { contentVersion: 5, packFormat: 1, bytes: hello } });
    app.contentApi.publish({ contentVersion: 5, packFormat: 1, bytes: hello });
    const launched = await app.launch();
    await launched
      .openKept(() => Promise.reject(new Error('The app mixes Editions')))
      .catch(() => undefined);

    await launched.checkForUpdate();

    expect(app.contentApi.downloaded).toEqual([5]);
    expect(await (await app.launch()).openKept(openPack)).toBe('kept 5');
  });
});
