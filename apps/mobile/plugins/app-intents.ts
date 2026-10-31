import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { EditionStrings } from '@slovo/contracts';

import { editionRoute } from '../src/edition/edition-link';
import { APP_INTENT_ROUTES } from '../src/entries/app-intents';

/**
 * What the App Intents take from the Edition at prebuild (ADR 0057), so the
 * Swift code holds no Edition text: only the intents that open a route.
 */
export interface AppIntentsEdition {
  /** The id of the Edition the app is built with, which each intent's route names (ADR 0065). */
  readonly editionId: string;
  /** The app's name on the home screen, which every phrase says and Siri hears as the app. */
  readonly displayName: string;
  readonly strings: EditionStrings['appIntents'];
}

type IntentKey = keyof EditionStrings['appIntents'];

/**
 * Each intent's Swift type (`SlovoAppIntents.swift`), the route it hands the
 * app as `<scheme>://<route>` (`APP_INTENT_ROUTES`), and the SF Symbol of its
 * App Shortcut. «Слово дня» opens the Feed, «Відкрити гру» the Game; the app
 * decides the landing from there.
 */
export const APP_INTENTS: Readonly<
  Record<IntentKey, { readonly type: string; readonly route: string; readonly symbol: string }>
> = {
  wordOfTheDay: {
    type: 'WordOfTheDayIntent',
    route: APP_INTENT_ROUTES.wordOfTheDay,
    symbol: 'text.book.closed',
  },
  openGame: { type: 'OpenGameIntent', route: APP_INTENT_ROUTES.openGame, symbol: 'puzzlepiece' },
};

/** The key of an intent's title in the app's `Localizable.strings`, as the Swift code names it. */
const titleKey = (intent: IntentKey) => `appIntents.${intent}`;

/** The intents' Swift sources kept in git, in the local module (ADR 0057). */
export const APP_INTENTS_SOURCE = fileURLToPath(
  new URL('../modules/spotlight/app-intents/SlovoAppIntents.swift', import.meta.url),
);

/** The intents' file in the native project. */
const APP_INTENTS_FILE = 'SlovoAppIntents.swift';

/** The file the prebuild writes with the App Shortcuts made from the Edition's strings. */
const SHORTCUTS_FILE = 'SlovoAppShortcuts.swift';

/** A Swift string literal's contents: its backslashes, quotes and line breaks escaped. */
const swiftText = (value: string) =>
  value.replaceAll('\\', '\\\\').replaceAll('"', '\\"').replaceAll('\n', '\\n');

/** A `.strings` value, quoted by Expo's locales: its backslashes and quotes escaped. */
const stringsText = (value: string) => value.replaceAll('\\', '\\\\').replaceAll('"', '\\"');

/**
 * A phrase as an App Shortcut takes it: the app's name, which every phrase
 * must say exactly once, becomes `\(.applicationName)`, so Siri hears it as
 * the app whatever the reader calls it.
 */
function shortcutPhrase(phrase: string, displayName: string, field: string): string {
  const parts = phrase.split(displayName);
  if (parts.length !== 2) {
    throw new Error(
      `${field}: «${phrase}» must name the app, ${displayName}, exactly once, as Siri requires of an App Shortcut`,
    );
  }
  return `"${parts.map(swiftText).join('\\(.applicationName)')}"`;
}

/**
 * The Swift source of the app's App Shortcuts: each intent with the
 * Edition's phrases, its title as short title and its symbol, so Siri and
 * the Shortcuts app know them with no setup; and the route each intent opens,
 * which names the Edition (`edition=<id>`), so the app opens it in that Edition.
 */
export function appShortcutsSwift({ editionId, displayName, strings }: AppIntentsEdition): string {
  const intents = Object.entries(APP_INTENTS) as [IntentKey, (typeof APP_INTENTS)[IntentKey]][];
  const shortcuts = intents.map(([key, { type, symbol }]) => {
    const phrases = strings[key].phrases.map((phrase, index) =>
      shortcutPhrase(phrase, displayName, `appIntents.${key}.phrases.${String(index)}`),
    );
    return [
      `    AppShortcut(`,
      `      intent: ${type}(),`,
      `      phrases: [${phrases.join(', ')}],`,
      `      shortTitle: "${titleKey(key)}",`,
      `      systemImageName: "${symbol}"`,
      `    )`,
    ].join('\n');
  });
  const routes = intents.map(
    ([, { type, route }]) => `extension ${type} {\n  static let route = "${swiftText(editionRoute(route, editionId))}"\n}\n`,
  );
  return [
    `// Made at prebuild from the Edition's strings (plugins/app-intents.ts); not kept in git.`,
    `import AppIntents`,
    ``,
    `struct SlovoAppShortcuts: AppShortcutsProvider {`,
    `  static var appShortcuts: [AppShortcut] {`,
    shortcuts.join('\n'),
    `  }`,
    `}`,
    ``,
    routes.join('\n'),
  ].join('\n');
}

/**
 * The intents' titles in the Edition's language, as the app's
 * `Localizable.strings` holds them (Expo's `locales`), so the Swift code
 * names each by its key.
 */
export function appIntentTitles(strings: EditionStrings['appIntents']): Record<string, string> {
  return Object.fromEntries(
    (Object.keys(APP_INTENTS) as IntentKey[]).map((key) => [
      titleKey(key),
      stringsText(strings[key].title),
    ]),
  );
}

/**
 * Writes the intents and the App Shortcuts into the app's own folder of the
 * native project (`ios/<project>`) and hands each file, by its path from
 * `ios` (`<project>/<file>`, since the app's group names no folder), to
 * `compile`, which adds it to the app's target: iOS reads App Shortcuts only
 * from the app itself, never from a pod.
 */
export function writeAppIntents(
  { iosDir, projectName }: { readonly iosDir: string; readonly projectName: string },
  edition: AppIntentsEdition,
  compile: (filepath: string) => void,
): void {
  const appDir = join(iosDir, projectName);
  mkdirSync(appDir, { recursive: true });
  copyFileSync(APP_INTENTS_SOURCE, join(appDir, APP_INTENTS_FILE));
  writeFileSync(join(appDir, SHORTCUTS_FILE), appShortcutsSwift(edition));
  compile(join(projectName, APP_INTENTS_FILE));
  compile(join(projectName, SHORTCUTS_FILE));
}
