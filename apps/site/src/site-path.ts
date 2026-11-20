/**
 * A path on the site under the base GitHub Pages serves it at, so
 * a link works from the landing and from a Word page alike: `uk/privacy` →
 * `/slovo/uk/privacy` at the github.io address, `/uk/privacy` behind the domain.
 */
export function sitePath(path = ''): string {
  return `${import.meta.env.BASE_URL.replace(/\/?$/, '/')}${path}`;
}
