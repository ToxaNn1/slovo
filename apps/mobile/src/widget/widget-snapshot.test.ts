import { WidgetSnapshotSchema, type WidgetSnapshot } from '@slovo/contracts';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  STAGED_WIDGET_SNAPSHOT_FILE,
  WIDGET_SNAPSHOT_FILE,
  createWidgetLinkKey,
  createWidgetSnapshotWriter,
  type WidgetDevice,
} from './widget-snapshot';

/** A Widget Snapshot with one Word in Усі слова, written at `writtenAt`. */
function snapshotAt(writtenAt: string): WidgetSnapshot {
  return {
    format: 1,
    editionId: 'uk',
    writtenAt,
    onboardingFinished: true,
    entries: [
      {
        kind: 'word',
        id: 'w_000001',
        headline: 'веремі́я',
        secondLine: 'Метушня, безлад.',
        voiceOver: 'веремія, Метушня, безлад.',
      },
    ],
    allEntries: ['w_000001'],
    favorites: [],
    collections: [],
  };
}

/**
 * The device's side of the widget, in memory: the App Group's container as
 * files by name, and every step (write, rename, reload) in the order it
 * happened. Setting `failing` makes that step throw.
 */
function fakeDevice() {
  const files = new Map<string, string>();
  const steps: string[] = [];
  const failure: { failing?: 'write' | 'replace' | undefined } = {};
  const device: WidgetDevice = {
    container: {
      async write(name, text) {
        await Promise.resolve();
        if (failure.failing === 'write') throw new Error('disk full');
        steps.push(`write ${name}`);
        files.set(name, text);
      },
      async replace(from, to) {
        await Promise.resolve();
        if (failure.failing === 'replace') throw new Error('rename failed');
        const text = files.get(from);
        if (text === undefined) throw new Error(`no file ${from}`);
        steps.push(`rename ${from} over ${to}`);
        files.delete(from);
        files.set(to, text);
      },
      read(name) {
        return Promise.resolve(files.get(name));
      },
    },
    reloadTimelines() {
      steps.push('reload');
    },
  };
  return { device, files, steps, failure };
}

/** The link key of the writer's snapshots in the tests that don't look at it. */
const LINK_KEY = 'k3yOfTheTests';
const linkKey = () => Promise.resolve(LINK_KEY);

/** A random source that answers `value` every time. */
const randomOf = (value: number) => ({ next: () => value });

/** Lets every pending write finish. */
const settled = () => new Promise((resolve) => setTimeout(resolve, 0));

afterEach(() => {
  vi.restoreAllMocks();
});

describe('writing the Widget Snapshot into the App Group', () => {
  it('writes the snapshot staged first and renamed over the file the widget reads', async () => {
    const { device, files, steps } = fakeDevice();

    createWidgetSnapshotWriter(
      device,
      linkKey,
    )(() => Promise.resolve(snapshotAt('2026-10-16T06:00:00.000Z')));
    await settled();

    expect(steps.slice(0, 2)).toEqual([
      `write ${STAGED_WIDGET_SNAPSHOT_FILE}`,
      `rename ${STAGED_WIDGET_SNAPSHOT_FILE} over ${WIDGET_SNAPSHOT_FILE}`,
    ]);
    expect([...files.keys()]).toEqual([WIDGET_SNAPSHOT_FILE]);
    expect(
      WidgetSnapshotSchema.parse(JSON.parse(files.get(WIDGET_SNAPSHOT_FILE) ?? '')).writtenAt,
    ).toBe('2026-10-16T06:00:00.000Z');
  });

  it('asks WidgetKit to reload the timelines after the rename', async () => {
    const { device, steps } = fakeDevice();

    createWidgetSnapshotWriter(
      device,
      linkKey,
    )(() => Promise.resolve(snapshotAt('2026-10-16T06:00:00.000Z')));
    await settled();

    expect(steps).toEqual([
      `write ${STAGED_WIDGET_SNAPSHOT_FILE}`,
      `rename ${STAGED_WIDGET_SNAPSHOT_FILE} over ${WIDGET_SNAPSHOT_FILE}`,
      'reload',
    ]);
  });

  it('writes the snapshot of that moment each time it is asked', async () => {
    const { device, files } = fakeDevice();
    const write = createWidgetSnapshotWriter(device, linkKey);
    let now = '2026-10-16T06:00:00.000Z';
    const snapshot = () => Promise.resolve(snapshotAt(now));
    write(snapshot);
    await settled();

    now = '2026-10-16T07:30:00.000Z';
    write(snapshot);
    await settled();

    expect(JSON.parse(files.get(WIDGET_SNAPSHOT_FILE) ?? '')).toMatchObject({ writtenAt: now });
  });

  it('writes one snapshot after the other, so an older one never lands last', async () => {
    const { device, files } = fakeDevice();
    const write = createWidgetSnapshotWriter(device, linkKey);
    let finishFirst: (snapshot: WidgetSnapshot) => void = () => undefined;

    write(
      () =>
        new Promise<WidgetSnapshot>((resolve) => {
          finishFirst = resolve;
        }),
    );
    write(() => Promise.resolve(snapshotAt('2026-10-16T07:30:00.000Z')));
    await settled();
    finishFirst(snapshotAt('2026-10-16T06:00:00.000Z'));
    await settled();

    expect(JSON.parse(files.get(WIDGET_SNAPSHOT_FILE) ?? '')).toMatchObject({
      writtenAt: '2026-10-16T07:30:00.000Z',
    });
  });

  it('writes nothing and asks for no reload when the Core builds no snapshot', async () => {
    const { device, files, steps } = fakeDevice();
    const write = createWidgetSnapshotWriter(device, linkKey);

    write(() => Promise.resolve(undefined));
    await settled();

    expect(steps).toEqual([]);
    expect(files.size).toBe(0);
  });

  it.each(['write', 'replace'] as const)(
    'ignores a failed %s, keeps the last good file and tries again at the next write',
    async (failing) => {
      vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      const { device, files, steps, failure } = fakeDevice();
      const write = createWidgetSnapshotWriter(device, linkKey);
      let now = '2026-10-16T06:00:00.000Z';
      const snapshot = () => Promise.resolve(snapshotAt(now));
      write(snapshot);
      await settled();
      const lastGood = files.get(WIDGET_SNAPSHOT_FILE);
      steps.length = 0;

      failure.failing = failing;
      now = '2026-10-16T07:30:00.000Z';
      write(snapshot);
      await settled();

      expect(files.get(WIDGET_SNAPSHOT_FILE)).toBe(lastGood);
      expect(steps).not.toContain('reload');

      failure.failing = undefined;
      write(snapshot);
      await settled();

      expect(JSON.parse(files.get(WIDGET_SNAPSHOT_FILE) ?? '')).toMatchObject({ writtenAt: now });
      expect(steps).toContain('reload');
    },
  );

  it('ignores a snapshot it fails to build', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { device, steps } = fakeDevice();

    createWidgetSnapshotWriter(
      device,
      linkKey,
    )(() => Promise.reject(new Error('the Language Pack is closed')));
    await settled();

    expect(steps).toEqual([]);
  });

  it('builds and writes nothing without the native modules, on a dev client from before the 0.6 build', async () => {
    const snapshot = vi.fn(() => Promise.resolve(snapshotAt('2026-10-16T06:00:00.000Z')));

    createWidgetSnapshotWriter(undefined, linkKey)(snapshot);
    await settled();

    expect(snapshot).not.toHaveBeenCalled();
  });
});

describe("the key the widget's links carry", () => {
  /** The link key of the snapshot the widget reads now. */
  const writtenKey = (files: Map<string, string>) =>
    WidgetSnapshotSchema.parse(JSON.parse(files.get(WIDGET_SNAPSHOT_FILE) ?? '')).linkKey;

  it('is in every snapshot, the same one through the app run', async () => {
    const { device, files } = fakeDevice();
    const write = createWidgetSnapshotWriter(
      device,
      createWidgetLinkKey(device.container, randomOf(0)),
    );

    write(() => Promise.resolve(snapshotAt('2026-10-16T06:00:00.000Z')));
    await settled();
    const first = writtenKey(files);
    write(() => Promise.resolve(snapshotAt('2026-10-16T07:30:00.000Z')));
    await settled();

    expect(first).toMatch(/^[A-Za-z0-9]{24}$/);
    expect(writtenKey(files)).toBe(first);
  });

  it('stays the one of the snapshot in the App Group in the next app run', async () => {
    const { device, files } = fakeDevice();
    createWidgetSnapshotWriter(
      device,
      createWidgetLinkKey(device.container, randomOf(0.1)),
    )(() => Promise.resolve(snapshotAt('2026-10-16T06:00:00.000Z')));
    await settled();
    const lastRun = writtenKey(files);

    const linkKeyOfNextRun = createWidgetLinkKey(device.container, randomOf(0.9));

    expect(await linkKeyOfNextRun()).toBe(lastRun);
  });

  it('is new from the random source when the App Group has no snapshot with a key', async () => {
    const { device, files } = fakeDevice();
    files.set(WIDGET_SNAPSHOT_FILE, 'not a snapshot');

    const first = await createWidgetLinkKey(device.container, randomOf(0))();
    const second = await createWidgetLinkKey(device.container, randomOf(0.99))();

    expect(first).toBe('A'.repeat(24));
    expect(second).toBe('9'.repeat(24));
  });
});
