/** The Edition each part of the running app says it belongs to. */
export interface EditionIds {
  /**
   * The Edition in the native app's Expo config. Absent when the build does
   * not report one; the other two are still compared.
   */
  native: string | undefined;
  /** The Edition whose config and strings the JavaScript bundle was built with. */
  bundle: string;
  /** The Edition recorded in the bundled Language Pack. */
  languagePack: string;
}

/**
 * Throws when the native app, the JavaScript bundle and the Language Pack are
 * not all of one Edition, e.g. a development client built for one Edition
 * that Metro serves another to.
 */
export function checkEditionsMatch({ native, bundle, languagePack }: EditionIds): void {
  const editions = [native, bundle, languagePack].filter((id) => id !== undefined);
  if (editions.every((id) => id === bundle)) return;
  const nativeDescription = native === undefined ? 'not reported' : `"${native}"`;
  throw new Error(
    `The app mixes Editions (native app: ${nativeDescription}, JavaScript bundle: "${bundle}", Language Pack: "${languagePack}"). Rebuild the Language Pack and the native app for one Edition.`,
  );
}
