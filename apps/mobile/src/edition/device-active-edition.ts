import { getLocales } from 'expo-localization';
import { Storage } from 'expo-sqlite/kv-store';

import { logError } from '../diagnostics/log';
import { chooseActiveEdition, type AppStore } from './active-edition';
import type { EditionRegistry } from './registry';

/**
 * The app-level store on the device: a key-value SQLite database of its own,
 * read synchronously, since the Edition is chosen before anything else opens.
 * When it can't be read or written, the choice lasts the run.
 */
const deviceAppStore: AppStore = {
  get(key) {
    try {
      return Storage.getItemSync(key) ?? undefined;
    } catch (error) {
      logError('Could not read the app-level store', error);
      return undefined;
    }
  },
  set(key, value) {
    try {
      Storage.setItemSync(key, value);
    } catch (error) {
      logError('Could not write the app-level store', error);
    }
  },
};

/** The active Edition of this run on the device, from its registry. */
export function deviceActiveEdition(registry: EditionRegistry): string {
  return chooseActiveEdition({
    editionIds: registry.ids,
    defaultId: registry.defaultId,
    deviceLanguages: getLocales().flatMap(({ languageCode }) => languageCode ?? []),
    appStore: deviceAppStore,
  });
}
