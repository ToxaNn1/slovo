import type { AppConfig } from '@slovo/contracts';

/** Where iOS looks for the file on the app's domain. */
export const APP_SITE_ASSOCIATION_PATH = '/.well-known/apple-app-site-association';

/**
 * The apple-app-site-association file (ADR 0058, 0065): it lets the one app
 * open the Collection Links of its domain, `https://<domain>/<edition>/c/<id>`,
 * under the Team ID and bundle id of the AppConfig, each Edition's path once.
 * While the Team ID is still empty there is no app to name, so there is no file.
 */
export function appSiteAssociation(
  { appleTeamId, bundleId }: AppConfig,
  editionIds: readonly string[],
) {
  if (appleTeamId === '') return undefined;
  const paths = [...new Set(editionIds)].map((id) => ({ '/': `/${id}/c/*` }));
  return {
    applinks: { details: [{ appIDs: [`${appleTeamId}.${bundleId}`], components: paths }] },
  };
}
