import type { ContentUpdate, Edition, PackVersion } from '@slovo/core';

/** A Language Pack the shell opened, with its version and what closes it. */
export interface OpenedPack<R> {
  readonly reader: R;
  readonly version: PackVersion;
  close(): Promise<void>;
}

/**
 * What content updates need on the device: the Content update module over the
 * bundled pack, and a way to open the kept pack.
 */
export interface ContentUpdates<R> {
  /** Opens the Content update module over the version of the bundled pack. */
  open(bundled: PackVersion): Promise<ContentUpdate>;
  /** Opens the kept pack of the version the module names; it rejects when it refuses the pack. */
  readonly openKeptPack: (version: PackVersion) => Promise<R>;
}

/** The Language Pack of the app run, with its version, and the Content update module, when content updates are on. */
export interface LaunchPack<R> {
  readonly reader: R;
  /** The version of the pack open, which a Mistake Report carries (ADR 0056). */
  readonly version: PackVersion;
  readonly contentUpdate: ContentUpdate | undefined;
}

/**
 * Opens the Language Pack of the app run. Content updates are on when the
 * Edition switches them on and the device has what keeps a downloaded pack
 * (`contentUpdates`; undefined on a binary without the file-system module).
 * Then the Content update module opens the kept pack when it wins over the
 * bundled one, which then closes; the pack never changes while it is open
 * (ADR 0015, 0032). A kept pack that fails to open, such as one of another
 * Edition, leaves the bundled one open. Otherwise, or when the module fails
 * to open, content updates are off and the bundled pack opens, as before
 * them. Only a failure of the bundled pack rejects.
 */
export async function openLaunchPack<R>({
  edition,
  contentUpdates,
  openBundled,
  onError,
}: {
  edition: Pick<Edition, 'isFeatureEnabled'>;
  contentUpdates: ContentUpdates<R> | undefined;
  /** Copies the pack bundled with the app into place and opens it. */
  openBundled: () => Promise<OpenedPack<R>>;
  onError: (error: unknown) => void;
}): Promise<LaunchPack<R>> {
  const bundled = await openBundled();
  if (contentUpdates === undefined || !edition.isFeatureEnabled('contentUpdates')) {
    return { reader: bundled.reader, version: bundled.version, contentUpdate: undefined };
  }
  let contentUpdate: ContentUpdate;
  try {
    contentUpdate = await contentUpdates.open(bundled.version);
  } catch (error) {
    onError(error);
    return { reader: bundled.reader, version: bundled.version, contentUpdate: undefined };
  }
  let kept: { readonly reader: R; readonly version: PackVersion } | undefined;
  try {
    kept = await contentUpdate.openKept(async (version) => ({
      reader: await contentUpdates.openKeptPack(version),
      version,
    }));
  } catch (error) {
    onError(error);
  }
  if (kept === undefined)
    return { reader: bundled.reader, version: bundled.version, contentUpdate };
  await bundled.close().catch(onError);
  return { ...kept, contentUpdate };
}
