import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * The one mobile shell builds whichever Edition the SLOVO_EDITION environment
 * variable selects. Everything Edition-specific in the native app comes from
 * the Edition folder; a missing or unknown Edition stops the build.
 */
const EDITION_VARIABLE = 'SLOVO_EDITION';

/** The fields of the Edition config the native app needs. */
interface NativeEditionConfig {
  id: string;
  locale: string;
  displayName: string;
  bundleId: string;
}

function knownEditions(editionsDir: string): string[] {
  return readdirSync(editionsDir, { withFileTypes: true })
    .filter(
      (entry) => entry.isDirectory() && existsSync(join(editionsDir, entry.name, 'edition.json')),
    )
    .map((entry) => entry.name)
    .sort();
}

function selectEdition(editionsDir: string): { dir: string; config: NativeEditionConfig } {
  const known = knownEditions(editionsDir);
  const hint = `Known Editions: ${known.join(', ')}. Example: ${EDITION_VARIABLE}=${known[0] ?? 'uk'} pnpm start`;
  // Expo types every environment variable as `any`; narrow it here.
  const value: unknown = process.env[EDITION_VARIABLE];
  const id = typeof value === 'string' ? value : undefined;
  if (id === undefined || id === '') {
    throw new Error(`${EDITION_VARIABLE} is not set, so there is no Edition to build.\n${hint}`);
  }
  if (!known.includes(id)) {
    throw new Error(`Unknown Edition "${id}" in ${EDITION_VARIABLE}.\n${hint}`);
  }
  const dir = join(editionsDir, id);
  // The Language Pack build validates the whole config against the contracts.
  const config = JSON.parse(readFileSync(join(dir, 'edition.json'), 'utf8')) as NativeEditionConfig;
  return { dir, config };
}

export default ({ config, projectRoot }: ConfigContext): ExpoConfig => {
  const edition = selectEdition(join(projectRoot, '../../editions'));
  const [language] = edition.config.locale.split('-');

  return {
    ...config,
    name: edition.config.displayName,
    slug: 'slovo',
    owner: 'anton_de',
    version: '0.1.0',
    scheme: `slovo-${edition.config.id}`,
    orientation: 'portrait',
    userInterfaceStyle: 'automatic',
    icon: relative(projectRoot, join(edition.dir, 'assets/icon.png')),
    ios: {
      bundleIdentifier: edition.config.bundleId,
      supportsTablet: false,
      infoPlist: {
        CFBundleDevelopmentRegion: language,
        CFBundleLocalizations: [language],
        ITSAppUsesNonExemptEncryption: false,
      },
    },
    plugins: [
      'expo-router',
      'expo-sqlite',
      ['expo-build-properties', { ios: { deploymentTarget: '17.0' } }],
    ],
    extra: {
      edition: { id: edition.config.id },
      // The EAS project @anton_de/slovo.
      eas: { projectId: 'e2401ef2-2a47-407e-b0ff-03706421b71c' },
    },
  };
};
