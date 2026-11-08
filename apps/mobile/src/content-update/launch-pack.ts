import type { ContentStore, ContentUpdate, Edition, PackVersion } from '@slovo/core';

/** The patched Language Pack opened, with the content store its Patches go through, and what closes it. */
export interface OpenedPack<R> {
  readonly reader: R;
  readonly version: PackVersion;
  readonly store: ContentStore;
  close(): Promise<void>;
}

/** The Language Pack of the app run, and the Content update module, when content updates are on. */
export interface LaunchPack<R> {
  readonly reader: R;
  /** The content version the pack holds now, which a Mistake Report carries (ADR 0056); a Patch raises it. */
  readonly contentVersion: () => number;
  readonly contentUpdate: ContentUpdate | undefined;
}

/**
 * Opens the Language Pack of the app run: the patched pack the runs before
 * left, which takes Patches while it is open (ADR 0090). The bundled pack is
 * copied over it first when there is none yet, when it does not open (another
 * Edition, a pack format the app does not read), or when the bundled one is
 * newer, as after an app update. Content updates are on when the Edition
 * switches them on. Only a pack that fails to open after the copy rejects.
 */
export async function openLaunchPack<R>({
  edition,
  bundledVersion,
  openPatched,
  replaceWithBundled,
  openContentUpdate,
  onError,
}: {
  edition: Pick<Edition, 'isFeatureEnabled'>;
  /** The version of the pack bundled with the app. */
  bundledVersion: () => Promise<PackVersion>;
  /** Opens the patched pack; it rejects when there is none or it refuses the pack. */
  openPatched: () => Promise<OpenedPack<R>>;
  /** Copies the bundled pack over the patched one. */
  replaceWithBundled: () => Promise<void>;
  openContentUpdate: (store: ContentStore) => ContentUpdate;
  onError: (error: unknown) => void;
}): Promise<LaunchPack<R>> {
  const bundled = await bundledVersion();
  let patched: OpenedPack<R> | undefined = await openPatched().catch(() => undefined);
  if (patched !== undefined && patched.version.contentVersion < bundled.contentVersion) {
    await patched.close().catch(onError);
    patched = undefined;
  }
  if (patched === undefined) {
    await replaceWithBundled();
    patched = await openPatched();
  }
  const { store } = patched;
  return {
    reader: patched.reader,
    contentVersion: () => store.contentVersion(),
    contentUpdate: edition.isFeatureEnabled('contentUpdates')
      ? openContentUpdate(store)
      : undefined,
  };
}
