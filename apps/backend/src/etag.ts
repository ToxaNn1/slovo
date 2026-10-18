/**
 * Whether an If-None-Match header names the ETag, by the weak comparison
 * RFC 9110 sets for it: `*`, or a list of ETags one of which, `W/` aside,
 * is this one.
 */
export function namesEtag(ifNoneMatch: string | undefined, etag: string): boolean {
  if (ifNoneMatch === undefined) return false;
  if (ifNoneMatch.trim() === '*') return true;
  return ifNoneMatch.split(',').some((tag) => tag.trim().replace(/^W\//, '') === etag);
}
