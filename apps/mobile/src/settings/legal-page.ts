import { Linking } from 'react-native';

import { logError } from '../diagnostics/log';

/** Opens one of the Edition's legal pages in the browser. */
export function openLegalPage(address: string) {
  Linking.openURL(address).catch((error: unknown) => {
    logError('Could not open a legal page', error);
  });
}
