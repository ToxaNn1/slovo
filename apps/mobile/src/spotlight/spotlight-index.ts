import type { SpotlightSnapshot } from '@slovo/contracts';

import { editionRoute } from '../edition/edition-link';

/**
 * One result of the iPhone search as the native module writes it into
 * CoreSpotlight (`modules/spotlight`). A tap on it opens `route` as a link
 * from outside the app (ADR 0057).
 */
export interface SpotlightItem {
  /** The route a tap opens, also the item's identifier in the index. */
  route: string;
  /** The result's title. */
  title: string;
  /** The line under the title. */
  details: string;
  /** Text the search matches but never shows: whole words, with no Stress mark. */
  searchText: string;
}

/** The local native module `SlovoSpotlight`, as its Swift defines it. */
export interface SpotlightModule {
  /** Replaces the app's whole index with these items; none empties it. */
  replaceIndex(items: SpotlightItem[]): Promise<void>;
}

/** The iPhone search's index of the app, which only ever holds the latest Spotlight Snapshot. */
export interface SpotlightIndex {
  /** Replaces the whole index with the snapshot, so an empty snapshot empties it. */
  replace(snapshot: SpotlightSnapshot): Promise<void>;
}

/**
 * The index over the native module, or one that writes nothing where the
 * binary lacks it: a dev client built before 0.8.15, another platform, a test.
 * Each item's route, its id in the index, names the active Edition
 * (`edition=<id>`, ADR 0065), so a tap opens it in that Edition.
 */
export function createSpotlightIndex(
  native: SpotlightModule | undefined,
  editionId: string,
): SpotlightIndex {
  if (native === undefined) return { replace: () => Promise.resolve() };
  return {
    replace: ({ entries, collections }) =>
      native.replaceIndex([
        ...entries.map(({ entry, route }) => ({
          route: editionRoute(route, editionId),
          title: entry.headline,
          details: entry.secondLine,
          searchText: entry.voiceOver,
        })),
        ...collections.map(({ name, secondLine, route }) => ({
          route: editionRoute(route, editionId),
          title: name,
          details: secondLine,
          searchText: name,
        })),
      ]),
  };
}
