import { serializeWidgetSnapshot, type WidgetSnapshot } from '@slovo/contracts';

/** The file in the App Group's container the widget reads the Widget Snapshot from. */
export const WIDGET_SNAPSHOT_FILE = 'widget-snapshot.json';

/**
 * Where a new snapshot is written in full before it is renamed over
 * `WIDGET_SNAPSHOT_FILE`, in the same container. The widget reads it when
 * the rename has taken the old file away and not yet put the new one in.
 */
export const STAGED_WIDGET_SNAPSHOT_FILE = 'widget-snapshot.staged.json';

/** The App Group's shared container, which the widget extension reads too. */
export interface SharedContainer {
  /** Writes `text` into the named file, which it creates or replaces. */
  write(name: string, text: string): Promise<void>;
  /** Renames the file `from` over the file `to`, which may exist. */
  replace(from: string, to: string): Promise<void>;
}

/** The device's side of the widget: the shared container and WidgetKit. */
export interface WidgetDevice {
  readonly container: SharedContainer;
  /** Asks WidgetKit to reload the SLOVO widget's timelines. */
  reloadTimelines(): void;
}

/**
 * Writes the Widget Snapshot into the App Group (ADR 0026): once now, when
 * the composition is open, and every time the app goes to the background,
 * where every change a reader can make has already happened. Each write is
 * whole: the snapshot is staged in a file of its own and then renamed over
 * the one the widget reads, and only then is WidgetKit asked to reload. A
 * failed write is ignored, so the widget keeps the last good file and the
 * next background tries again. Writes run one after the other, so an older
 * snapshot never lands last. Without `device` (a dev client built before the
 * 0.6 batch) nothing is built or written. Returns the call that stops it.
 */
export function writeWidgetSnapshots({
  device,
  snapshot,
  onBackground,
}: {
  device: WidgetDevice | undefined;
  snapshot: () => Promise<WidgetSnapshot>;
  /** Calls the listener each time the app goes to the background; returns the call that stops it. */
  onBackground: (listener: () => void) => () => void;
}): () => void {
  if (device === undefined) return () => undefined;
  const { container } = device;
  let stopped = false;
  let writing = Promise.resolve();

  async function writeOnce(): Promise<void> {
    try {
      const text = serializeWidgetSnapshot(await snapshot());
      await container.write(STAGED_WIDGET_SNAPSHOT_FILE, text);
      await container.replace(STAGED_WIDGET_SNAPSHOT_FILE, WIDGET_SNAPSHOT_FILE);
      device?.reloadTimelines();
    } catch (error) {
      console.warn('Could not write the Widget Snapshot; the next background tries again', error);
    }
  }

  function write(): void {
    writing = writing.then(() => (stopped ? undefined : writeOnce()));
  }

  write();
  const stop = onBackground(write);
  return () => {
    stopped = true;
    stop();
  };
}
