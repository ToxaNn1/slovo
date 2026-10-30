import type { Edition } from '@slovo/server-core';

/** Where iOS looks for the file on a link domain. */
export const APP_SITE_ASSOCIATION_PATH = '/.well-known/apple-app-site-association';

/**
 * The apple-app-site-association file (ADR 0058): it lets the app of every
 * Edition the backend serves open the Collection Links of its link domain,
 * `https://<linkDomain>/c/<id>`, under the Team ID and bundle id of the
 * Edition's config. Each app claims only its own domain in its associated
 * domains entitlement, so one file serves every domain. An Edition whose
 * Team ID is still empty has no app to name; with none, there is no file.
 */
export function appSiteAssociation(editions: readonly Edition[]) {
  const details = editions
    .filter(({ config }) => config.appleTeamId !== '')
    .map(({ config }) => ({
      appIDs: [`${config.appleTeamId}.${config.bundleId}`],
      components: [{ '/': '/c/*' }],
    }));
  return details.length === 0 ? undefined : { applinks: { details } };
}
