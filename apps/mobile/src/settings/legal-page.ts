import { editionSite } from '@slovo/contracts';
import { Linking } from 'react-native';

import { logError } from '../diagnostics/log';
import { appDomain, edition } from '../edition/edition';

/** A legal page of an Edition (ADR 0049). */
export type LegalPage = 'privacy' | 'terms';

/** The address of the active Edition's legal page, `https://<domain>/<edition>/<page>` (ADR 0065). */
export function legalPageAddress(page: LegalPage): string {
  return `${editionSite(appDomain, edition.id)}/${page}`;
}

/** Opens one of the active Edition's legal pages in the browser. */
export function openLegalPage(page: LegalPage) {
  Linking.openURL(legalPageAddress(page)).catch((error: unknown) => {
    logError('Could not open a legal page', error);
  });
}
