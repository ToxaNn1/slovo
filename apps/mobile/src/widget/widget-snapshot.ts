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
 * Writes the Widget Snapshot into the App Group (ADR 0026), each time it is
 * asked: the lifecycle adapter asks when the composition opens and every time
 * the app goes to the background, where every change a reader can make has
 * already happened. Each write is whole: the snapshot is staged in a file of
 * its own and then renamed over the one the widget reads, and only then is
 * WidgetKit asked to reload. A failed write is ignored, so the widget keeps
 * the last good file and the next write tries again. Writes run one after the
 * other, each building its snapshot in its turn, so an older snapshot never
 * lands last. A snapshot the Core doesn't build, as the widget's Feature
 * Switch is off, writes nothing and asks for no reload. Without `device` (a dev client built before the 0.6 batch)
 * nothing is built or written.
 */
export function createWidgetSnapshotWriter(
  device: WidgetDevice | undefined,
): (snapshot: () => Promise<WidgetSnapshot | undefined>) => void {
  if (device === undefined) return () => undefined;
  const widget: WidgetDevice = device;
  let writing = Promise.resolve();

  async function writeOnce(snapshot: () => Promise<WidgetSnapshot | undefined>): Promise<void> {
    try {
      const built = await snapshot();
      // The widget's Feature Switch is off: no new snapshot, and the widget keeps the last file.
      if (built === undefined) return;
      const text = serializeWidgetSnapshot(built);
      await widget.container.write(STAGED_WIDGET_SNAPSHOT_FILE, text);
      await widget.container.replace(STAGED_WIDGET_SNAPSHOT_FILE, WIDGET_SNAPSHOT_FILE);
      widget.reloadTimelines();
    } catch (error) {
      console.warn('Could not write the Widget Snapshot; the next write tries again', error);
    }
  }

  return (snapshot) => {
    writing = writing.then(() => writeOnce(snapshot));
  };
}
