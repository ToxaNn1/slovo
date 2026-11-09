const versionParts = (version: string) => version.split('.').map(Number);

/** Whether `version` reads as an app version: numbers joined by dots, as `1.2.0`. */
export const isAppVersion = (version: string) => /^\d+(\.\d+)*$/.test(version);

/** Compares two app versions by number, part by part. */
export function compareVersions(a: string, b: string): number {
  const [partsA, partsB] = [versionParts(a), versionParts(b)];
  for (let i = 0; i < Math.max(partsA.length, partsB.length); i += 1) {
    const difference = (partsA[i] ?? 0) - (partsB[i] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}
