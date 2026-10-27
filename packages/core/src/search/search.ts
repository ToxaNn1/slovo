import type { Word } from '@slovo/contracts';

import type { Edition } from '../edition/edition';
import type { ContentReadPort } from '../ports';
import type { UserState } from '../user-state/user-state';
import { userStateRecords } from '../user-state/user-state-schema';
import { searchKey } from './search-key';

/** The shortest query Search answers, in letters of its Search key (ADR 0054). */
const SHORTEST_QUERY = 2;

/** The most Entries a group of results holds (ADR 0054). */
const GROUP_LIMIT = 50;

/** What Search found, each kind in its own group. */
export interface SearchResults {
  /** The Words whose Lemma matches: exact matches first, then in the Edition's alphabet. */
  readonly words: readonly Word[];
}

/**
 * Search («Пошук», ADR 0054): finds Entries by their visible text, over every
 * live Entry that is not Hidden, the Mix and the Rarity Floor aside, so a
 * reader finds anything the app knows.
 */
export interface Search {
  /**
   * The Entries whose text, or any of its words, starts with the query, as
   * the Search key reads both: from 2 letters, up to 50 a group. Nothing
   * while the Edition turns Search off. The Hidden Entries are read afresh on
   * every call, the Language Pack once: it never changes while it is open.
   */
  search(query: string): Promise<SearchResults>;
}

const NOTHING: SearchResults = { words: [] };

/** Whether the text, as its Search key, or any of its words starts with the query's key. */
const matches = (key: string, query: string) =>
  key.startsWith(query) || key.split(' ').some((part) => part.startsWith(query));

/** Opens Search over the Language Pack and the user's Hidden Entries. */
export function createSearch({
  content,
  edition,
  userState,
}: {
  content: Pick<ContentReadPort, 'listWords'>;
  edition: Pick<Edition, 'isFeatureEnabled' | 'searchLetters'> & {
    readonly languageTraits: Pick<Edition['languageTraits'], 'sortLocale'>;
  };
  userState: Pick<UserState, 'list'>;
}): Search {
  const keyOf = (text: string) => searchKey(text, edition.searchLetters);
  const collator = new Intl.Collator(edition.languageTraits.sortLocale);

  /** The live Words with their Lemmas' Search keys, read once; a read that fails is tried again. */
  let keyed: Promise<readonly { word: Word; key: string }[]> | undefined;
  const readKeyed = () =>
    (keyed ??= content
      .listWords()
      .then((words) => words.map((word) => ({ word, key: keyOf(word.lemma) })))
      .catch((error: unknown) => {
        keyed = undefined;
        throw error;
      }));

  return {
    async search(query) {
      const wanted = keyOf(query);
      if (!edition.isFeatureEnabled('search') || Array.from(wanted).length < SHORTEST_QUERY) {
        return NOTHING;
      }
      const [words, hidden] = await Promise.all([
        readKeyed(),
        userState.list(userStateRecords.hiddenEntries),
      ]);
      const found = words.filter(({ word, key }) => !hidden.has(word.id) && matches(key, wanted));
      const exact = ({ key }: { key: string }) => (key === wanted ? 0 : 1);
      return {
        words: found
          .sort((a, b) => exact(a) - exact(b) || collator.compare(a.word.lemma, b.word.lemma))
          .slice(0, GROUP_LIMIT)
          .map(({ word }) => word),
      };
    },
  };
}
