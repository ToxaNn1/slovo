import { WidgetSnapshotSchema, type WidgetSnapshot } from '@slovo/contracts';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  STAGED_WIDGET_SNAPSHOT_FILE,
  WIDGET_SNAPSHOT_FILE,
  writeWidgetSnapshots,
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

/** The app's moves to the background, which the test makes one at a time. */
function backgrounds() {
  const listeners = new Set<() => void>();
  return {
    onBackground: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    leave: () => {
      for (const listener of listeners) listener();
    },
  };
}

/** Lets every pending write finish. */
const settled = () => new Promise((resolve) => setTimeout(resolve, 0));

afterEach(() => {
  vi.restoreAllMocks();
});

describe('writing the Widget Snapshot into the App Group', () => {
  it('writes the snapshot when the composition opens, staged first and renamed over the file the widget reads', async () => {
    const { device, files, steps } = fakeDevice();

    writeWidgetSnapshots({
      device,
      snapshot: () => Promise.resolve(snapshotAt('2026-10-16T06:00:00.000Z')),
      onBackground: backgrounds().onBackground,
    });
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

    writeWidgetSnapshots({
      device,
      snapshot: () => Promise.resolve(snapshotAt('2026-10-16T06:00:00.000Z')),
      onBackground: backgrounds().onBackground,
    });
    await settled();

    expect(steps).toEqual([
      `write ${STAGED_WIDGET_SNAPSHOT_FILE}`,
      `rename ${STAGED_WIDGET_SNAPSHOT_FILE} over ${WIDGET_SNAPSHOT_FILE}`,
      'reload',
    ]);
  });

  it('writes the snapshot of that moment every time the app goes to the background', async () => {
    const { device, files } = fakeDevice();
    const app = backgrounds();
    let now = '2026-10-16T06:00:00.000Z';
    writeWidgetSnapshots({
      device,
      snapshot: () => Promise.resolve(snapshotAt(now)),
      onBackground: app.onBackground,
    });
    await settled();

    now = '2026-10-16T07:30:00.000Z';
    app.leave();
    await settled();

    expect(JSON.parse(files.get(WIDGET_SNAPSHOT_FILE) ?? '')).toMatchObject({ writtenAt: now });
  });

  it('writes one snapshot after the other, so an older one never lands last', async () => {
    const { device, files } = fakeDevice();
    const app = backgrounds();
    let finishFirst: (snapshot: WidgetSnapshot) => void = () => undefined;
    const snapshots = [
      new Promise<WidgetSnapshot>((resolve) => {
        finishFirst = resolve;
      }),
      Promise.resolve(snapshotAt('2026-10-16T07:30:00.000Z')),
    ];
    writeWidgetSnapshots({
      device,
      snapshot: () => snapshots.shift() ?? Promise.reject(new Error('no more')),
      onBackground: app.onBackground,
    });

    app.leave();
    finishFirst(snapshotAt('2026-10-16T06:00:00.000Z'));
    await settled();

    expect(JSON.parse(files.get(WIDGET_SNAPSHOT_FILE) ?? '')).toMatchObject({
      writtenAt: '2026-10-16T07:30:00.000Z',
    });
  });

  it.each(['write', 'replace'] as const)(
    'ignores a failed %s, keeps the last good file and tries again at the next background',
    async (failing) => {
      vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      const { device, files, steps, failure } = fakeDevice();
      const app = backgrounds();
      let now = '2026-10-16T06:00:00.000Z';
      writeWidgetSnapshots({
        device,
        snapshot: () => Promise.resolve(snapshotAt(now)),
        onBackground: app.onBackground,
      });
      await settled();
      const lastGood = files.get(WIDGET_SNAPSHOT_FILE);
      steps.length = 0;

      failure.failing = failing;
      now = '2026-10-16T07:30:00.000Z';
      app.leave();
      await settled();

      expect(files.get(WIDGET_SNAPSHOT_FILE)).toBe(lastGood);
      expect(steps).not.toContain('reload');

      failure.failing = undefined;
      app.leave();
      await settled();

      expect(JSON.parse(files.get(WIDGET_SNAPSHOT_FILE) ?? '')).toMatchObject({ writtenAt: now });
      expect(steps).toContain('reload');
    },
  );

  it('ignores a snapshot it fails to build', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { device, steps } = fakeDevice();

    writeWidgetSnapshots({
      device,
      snapshot: () => Promise.reject(new Error('the Language Pack is closed')),
      onBackground: backgrounds().onBackground,
    });
    await settled();

    expect(steps).toEqual([]);
  });

  it('builds and writes nothing without the native modules, on a dev client from before the 0.6 build', async () => {
    const snapshot = vi.fn(() => Promise.resolve(snapshotAt('2026-10-16T06:00:00.000Z')));
    const app = backgrounds();

    writeWidgetSnapshots({ device: undefined, snapshot, onBackground: app.onBackground });
    app.leave();
    await settled();

    expect(snapshot).not.toHaveBeenCalled();
  });

  it('writes nothing more once stopped', async () => {
    const { device, steps } = fakeDevice();
    const app = backgrounds();
    const stop = writeWidgetSnapshots({
      device,
      snapshot: () => Promise.resolve(snapshotAt('2026-10-16T06:00:00.000Z')),
      onBackground: app.onBackground,
    });
    await settled();
    steps.length = 0;

    stop();
    app.leave();
    await settled();

    expect(steps).toEqual([]);
  });
});
