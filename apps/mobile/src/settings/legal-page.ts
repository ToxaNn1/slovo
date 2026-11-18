import { editionSite } from '@slovo/contracts';
import { openBrowserAsync, WebBrowserPresentationStyle } from 'expo-web-browser';

import { logError } from '../diagnostics/log';
import { appDomain, edition } from '../edition/edition';

/** A legal page of an Edition (ADR 0049). */
export type LegalPage = 'privacy' | 'terms';

/** The address of the active Edition's legal page, `https://<domain>/<edition>/<page>` (ADR 0065). */
function legalPageAddress(page: LegalPage): string {
  return `${editionSite(appDomain, edition.id)}/${page}`;
}

/**
 * Opens one of the active Edition's legal pages inside the app, in the system's
 * in-app browser on a sheet that «Готово» closes, never in Safari (ADR 0187).
 */
export function openLegalPage(page: LegalPage) {
  openBrowserAsync(legalPageAddress(page), {
    presentationStyle: WebBrowserPresentationStyle.PAGE_SHEET,
    dismissButtonStyle: 'done',
  }).catch((error: unknown) => {
    logError('Could not open a legal page', error);
  });
}
