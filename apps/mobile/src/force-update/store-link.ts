import type { Platform } from '@slovo/contracts';
import { Linking } from 'react-native';

import { logError } from '../diagnostics/log';
import { appStore } from '../edition/edition';

/**
 * The address of the app's page in the store of `platform`: on iOS by its App
 * Store Connect id, or a search by its name until the app is created; on
 * Android by its bundle id.
 */
export function storeAddress(platform: Platform, store = appStore): string {
  if (platform === 'android') {
    return `https://play.google.com/store/apps/details?id=${store.bundleId}`;
  }
  return store.appStoreConnectAppId === ''
    ? `https://apps.apple.com/search?term=${encodeURIComponent(store.name)}`
    : `https://apps.apple.com/app/id${store.appStoreConnectAppId}`;
}

/** Opens the app's page in the store of `platform`. */
export function openStore(platform: Platform) {
  Linking.openURL(storeAddress(platform)).catch((error: unknown) => {
    logError('Could not open the store', error);
  });
}
