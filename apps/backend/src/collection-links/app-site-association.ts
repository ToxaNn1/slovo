import type { AppConfig } from '@slovo/contracts';

/** Where iOS looks for the file on the app's domain. */
export const APP_SITE_ASSOCIATION_PATH = '/.well-known/apple-app-site-association';

/**
 * The apple-app-site-association file (ADR 0058, 0065): it lets the one app
 * open the Collection Links of its domain, `https://<domain>/c/<id>`, under
 * the Team ID and bundle id of the AppConfig. While the Team ID is still
 * empty there is no app to name, so there is no file.
 */
export function appSiteAssociation({ appleTeamId, bundleId }: AppConfig) {
  if (appleTeamId === '') return undefined;
  return {
    applinks: {
      details: [{ appIDs: [`${appleTeamId}.${bundleId}`], components: [{ '/': '/c/*' }] }],
    },
  };
}
