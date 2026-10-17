import type { ContentUpdate, Edition, PackFiles, PackVersion } from '@slovo/core';

/** A Language Pack the shell opened, with its version and what closes it. */
export interface OpenedPack<R> {
  readonly reader: R;
  readonly version: PackVersion;
  close(): Promise<void>;
}

/**
 * What content updates need on the device: the `PackFiles` that keep a
 * downloaded pack, the Content update module over the bundled pack, and a way
 * to open the kept pack.
 */
export interface ContentUpdates<R> {
  readonly packFiles: PackFiles;
  /** Opens the Content update module over the version of the bundled pack. */
  open(bundled: PackVersion): Promise<ContentUpdate>;
  /** Opens the kept pack of the version; it rejects when it refuses the pack. */
  openKept(version: PackVersion): Promise<R>;
}

/** The Language Pack of the app run, and the Content update module, when content updates are on. */
export interface LaunchPack<R> {
  readonly reader: R;
  readonly contentUpdate: ContentUpdate | undefined;
}

/**
 * Opens the Language Pack of the app run. Content updates are on when the
 * Edition switches them on and the device has what keeps a downloaded pack
 * (`contentUpdates`; undefined on a binary without the file-system module).
 * Then the Content update module chooses between the bundled pack and the
 * kept one, and the chosen pack opens; it never changes while it is open
 * (ADR 0015, 0032). A kept pack that fails to open, such as one of another
 * Edition, is forgotten and the bundled one opens. Otherwise, or when the
 * module fails to open, content updates are off and the bundled pack opens,
 * as before them. Only a failure of the bundled pack rejects.
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
    return { reader: bundled.reader, contentUpdate: undefined };
  }
  let contentUpdate: ContentUpdate;
  try {
    contentUpdate = await contentUpdates.open(bundled.version);
  } catch (error) {
    onError(error);
    return { reader: bundled.reader, contentUpdate: undefined };
  }
  const { packFiles } = contentUpdates;
  let kept: R | undefined;
  try {
    const version =
      (await contentUpdate.choosePack()) === 'kept' ? await packFiles.read() : undefined;
    if (version !== undefined) kept = await contentUpdates.openKept(version);
  } catch (error) {
    onError(error);
    // The next due check downloads it again.
    await packFiles.forget().catch(onError);
  }
  if (kept === undefined) return { reader: bundled.reader, contentUpdate };
  await bundled.close().catch(onError);
  return { reader: kept, contentUpdate };
}
