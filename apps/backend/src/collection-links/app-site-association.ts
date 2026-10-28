import type { Edition } from '@slovo/server-core';

/** Where iOS looks for the file on a link domain. */
export const APP_SITE_ASSOCIATION_PATH = '/.well-known/apple-app-site-association';

/**
 * The apple-app-site-association file (ADR 0058): it lets the app of every
 * Edition the backend serves open the Collection Links of its link domain,
 * `https://<linkDomain>/c/<id>`. Each app claims only its own domain in its
 * associated domains entitlement, so one file serves every domain.
 */
export function appSiteAssociation(teamId: string, editions: readonly Edition[]) {
  return {
    applinks: {
      details: editions.map(({ config }) => ({
        appIDs: [`${teamId}.${config.bundleId}`],
        components: [{ '/': '/c/*' }],
      })),
    },
  };
}
