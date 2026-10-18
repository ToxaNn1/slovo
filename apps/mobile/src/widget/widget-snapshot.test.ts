import { WidgetSnapshotSchema, type WidgetSnapshot } from '@slovo/contracts';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  STAGED_WIDGET_SNAPSHOT_FILE,
  WIDGET_SNAPSHOT_FILE,
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
    },
    reloadTimelines() {
      steps.push('reload');
    },
  };
  return { device, files, steps, failure };
}

/** Lets every pending write finish. */
const settled = () => new Promise((resolve) => setTimeout(resolve, 0));

afterEach(() => {
  vi.restoreAllMocks();
});

describe('writing the Widget Snapshot into the App Group', () => {
  it('writes the snapshot staged first and renamed over the file the widget reads', async () => {
    const { device, files, steps } = fakeDevice();

    createWidgetSnapshotWriter(device)(() =>
      Promise.resolve(snapshotAt('2026-10-16T06:00:00.000Z')),
    );
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

    createWidgetSnapshotWriter(device)(() =>
      Promise.resolve(snapshotAt('2026-10-16T06:00:00.000Z')),
    );
    await settled();

    expect(steps).toEqual([
      `write ${STAGED_WIDGET_SNAPSHOT_FILE}`,
      `rename ${STAGED_WIDGET_SNAPSHOT_FILE} over ${WIDGET_SNAPSHOT_FILE}`,
      'reload',
    ]);
  });

  it('writes the snapshot of that moment each time it is asked', async () => {
    const { device, files } = fakeDevice();
    const write = createWidgetSnapshotWriter(device);
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
    const write = createWidgetSnapshotWriter(device);
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
    const write = createWidgetSnapshotWriter(device);

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
      const write = createWidgetSnapshotWriter(device);
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

    createWidgetSnapshotWriter(device)(() =>
      Promise.reject(new Error('the Language Pack is closed')),
    );
    await settled();

    expect(steps).toEqual([]);
  });

  it('builds and writes nothing without the native modules, on a dev client from before the 0.6 build', async () => {
    const snapshot = vi.fn(() => Promise.resolve(snapshotAt('2026-10-16T06:00:00.000Z')));

    createWidgetSnapshotWriter(undefined)(snapshot);
    await settled();

    expect(snapshot).not.toHaveBeenCalled();
  });
});
