/**
 * The search param that names the Edition a link of a native surface (the
 * widget, Spotlight, an App Intent) belongs to, `edition=<id>` (ADR 0065).
 * The app opens such a link only in that Edition (`createOutsideLinks`).
 */
export const EDITION_PARAM = 'edition';

/** A route, such as `entry/<id>` or `game?intent=openGame`, that names its Edition. */
export function editionRoute(route: string, editionId: string): string {
  return `${route}${route.includes('?') ? '&' : '?'}${EDITION_PARAM}=${editionId}`;
}
