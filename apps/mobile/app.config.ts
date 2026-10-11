import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

import type * as Contracts from '@slovo/contracts';
import type { ConfigContext, ExpoConfig } from 'expo/config';
import { require as tsxRequire } from 'tsx/cjs/api';

type EditionConfig = Contracts.EditionConfig;

// Expo evaluates this file with plain Node, which cannot load the TypeScript
// sources of the workspace packages (their relative imports have no file
// extension). tsx loads them, so the config is checked by the same schema as
// the Language Pack build and the app.
const { EditionConfigSchema } = tsxRequire('@slovo/contracts', import.meta.url) as typeof Contracts;

/**
 * The one mobile shell builds whichever Edition the SLOVO_EDITION environment
 * variable selects. Everything Edition-specific in the native app comes from
 * the Edition folder; a missing or unknown Edition stops the build.
 */
const EDITION_VARIABLE = 'SLOVO_EDITION';

function knownEditions(editionsDir: string): string[] {
  return readdirSync(editionsDir, { withFileTypes: true })
    .filter(
      (entry) => entry.isDirectory() && existsSync(join(editionsDir, entry.name, 'edition.json')),
    )
    .map((entry) => entry.name)
    .sort();
}

/** The Edition config, checked against the contracts, with every problem named by its field. */
function readEditionConfig(editionDir: string, id: string): EditionConfig {
  const file = join(editionDir, 'edition.json');
  const result = EditionConfigSchema.safeParse(JSON.parse(readFileSync(file, 'utf8')));
  if (!result.success) {
    const problems = result.error.issues.map(
      ({ path, message }) => `  ${path.length === 0 ? '(config)' : path.join('.')}: ${message}`,
    );
    throw new Error(`${file} is not a valid Edition config:\n${problems.join('\n')}`);
  }
  // Metro and the Language Pack look the Edition up by this id.
  if (result.data.id !== id) {
    throw new Error(`${file} has id "${result.data.id}" but lives in the folder "${id}"`);
  }
  return result.data;
}

function selectEdition(editionsDir: string): { dir: string; config: EditionConfig } {
  const known = knownEditions(editionsDir);
  const hint = `Known Editions: ${known.join(', ')}. Example: ${EDITION_VARIABLE}=${known[0] ?? '<edition>'} pnpm start`;
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
  return { dir, config: readEditionConfig(dir, id) };
}

export default ({ config, projectRoot }: ConfigContext): ExpoConfig => {
  const edition = selectEdition(join(projectRoot, '../../editions'));
  const [language] = edition.config.locale.split('-');
  const icon = join(edition.dir, 'assets/icon.png');
  if (!existsSync(icon)) {
    throw new Error(`Edition "${edition.config.id}" has no icon: expected ${icon}`);
  }

  return {
    ...config,
    name: edition.config.displayName,
    slug: 'slovo',
    owner: 'anton_de',
    version: '0.1.0',
    scheme: `slovo-${edition.config.id}`,
    orientation: 'portrait',
    userInterfaceStyle: 'automatic',
    icon: relative(projectRoot, icon),
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
