import {
  serializeWidgetSnapshot,
  WidgetSnapshotSchema,
  type WidgetSnapshot,
} from '@slovo/contracts';
import type { Random } from '@slovo/core';

import { logWarning } from '../log';

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
  /** The text of the named file, or nothing when there is no such file. */
  read(name: string): Promise<string | undefined>;
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
 * Switch is off, writes nothing and asks for no reload. Each snapshot carries
 * `linkKey`, the key the widget's links carry. Without `device` (a
 * dev client built before the 0.6 batch) nothing is built or written.
 */
export function createWidgetSnapshotWriter(
  device: WidgetDevice | undefined,
  linkKey: () => Promise<string | undefined>,
): (snapshot: () => Promise<WidgetSnapshot | undefined>) => void {
  if (device === undefined) return () => undefined;
  const widget: WidgetDevice = device;
  let writing = Promise.resolve();

  async function writeOnce(snapshot: () => Promise<WidgetSnapshot | undefined>): Promise<void> {
    try {
      const built = await snapshot();
      if (built === undefined) return;
      const text = serializeWidgetSnapshot({ ...built, linkKey: await linkKey() });
      await widget.container.write(STAGED_WIDGET_SNAPSHOT_FILE, text);
      await widget.container.replace(STAGED_WIDGET_SNAPSHOT_FILE, WIDGET_SNAPSHOT_FILE);
      widget.reloadTimelines();
    } catch (error) {
      logWarning('Could not write the Widget Snapshot; the next write tries again', error);
    }
  }

  return (snapshot) => {
    writing = writing.then(() => writeOnce(snapshot));
  };
}

/** The characters of a link key, safe in a URL as they are. */
const LINK_KEY_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

/** The length of a link key: 128 bits and more of `random`. */
const LINK_KEY_LENGTH = 24;

/** The link key of the snapshot in `text`, or nothing for a file without one or one the contracts refuse. */
function linkKeyOf(text: string | undefined): string | undefined {
  if (text === undefined) return undefined;
  try {
    return WidgetSnapshotSchema.safeParse(JSON.parse(text)).data?.linkKey;
  } catch {
    return undefined;
  }
}

/**
 * The key the widget's links to an Entry carry (`WidgetSnapshot.linkKey`),
 * the same for the whole app run: the one of the snapshot in the App Group,
 * which the widget's links on the home screen carry already, or, with none
 * there, a new one from `random`, which the next snapshot takes there. An
 * app or a web page can't read the App Group, so it can't make a link that
 * passes for the widget's. The snapshot is looked for as the widget looks for
 * it, the staged file when the rename has taken the other away.
 */
export function createWidgetLinkKey(
  container: SharedContainer,
  random: Random,
): () => Promise<string> {
  async function read(): Promise<string> {
    for (const name of [WIDGET_SNAPSHOT_FILE, STAGED_WIDGET_SNAPSHOT_FILE]) {
      const key = linkKeyOf(await container.read(name).catch(() => undefined));
      if (key !== undefined) return key;
    }
    return Array.from({ length: LINK_KEY_LENGTH }, () =>
      LINK_KEY_ALPHABET.charAt(Math.floor(random.next() * LINK_KEY_ALPHABET.length)),
    ).join('');
  }
  let key: Promise<string> | undefined;
  return () => (key ??= read());
}
