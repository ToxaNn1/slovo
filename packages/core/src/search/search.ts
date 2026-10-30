import type { Correction, Entry, Idiom, SynonymRow, Tip, Word } from '@slovo/contracts';

import type { Edition } from '../edition/edition';
import { featureOfKind, type MixKind } from '../entries/mix';
import type { ContentReadPort } from '../ports';
import type { UserState } from '../user-state/user-state';
import { userStateRecords } from '../user-state/user-state-schema';
import { searchKey } from './search-key';

/** The shortest query Search answers, in letters of its Search key (ADR 0054). */
const SHORTEST_QUERY = 2;

/** The shortest query «За значенням» answers, in letters of its Search key (ADR 0054). */
const SHORTEST_MEANING_QUERY = 3;

/** The most Entries a group of results holds (ADR 0054). */
const GROUP_LIMIT = 50;

/**
 * What Search found, each kind in its own group («Слова», «Виправлення»,
 * «Вислови», «Синоніми», «Поради»): exact matches first, then in the
 * Edition's alphabet by the text the Entry is shown by. A kind the Edition
 * turns off gives an empty group.
 */
export interface SearchResults {
  /** The Words whose Lemma matches. */
  readonly words: readonly Word[];
  /** The Corrections whose non-standard form or any standard form matches, in the order of their non-standard forms. */
  readonly corrections: readonly Correction[];
  /** The Idioms whose expression matches. */
  readonly idioms: readonly Idiom[];
  /** The Synonym Rows whose dominant or any member matches, in the order of their dominants. */
  readonly synonymRows: readonly SynonymRow[];
  /** The Tips whose title matches. */
  readonly tips: readonly Tip[];
  /**
   * «За значенням»: the Words whose Definition contains the query and the
   * Synonym Rows that contain it, together in the Edition's alphabet by the
   * Lemma or the dominant.
   */
  readonly byMeaning: readonly (Word | SynonymRow)[];
}

/**
 * Search («Пошук», ADR 0054): finds Entries by their visible text, over every
 * live Entry that is not Hidden, the Mix and the Rarity Floor aside, so a
 * reader finds anything the app knows.
 */
export interface Search {
  /**
   * The Entries whose text, or any of its words, starts with the query, as
   * the Search key reads both: from 2 letters, up to 50 a group; from 3
   * letters, «За значенням» as well. Nothing
   * while the Edition turns Search off. The Hidden Entries are read afresh on
   * every call, the Language Pack once: it never changes while it is open.
   */
  search(query: string): Promise<SearchResults>;
  /**
   * Whether Search answers the query: 2 letters of its Search key at least,
   * while the Edition turns Search on. A query it answers with no Entry found
   * is «Нічого не знайдено»; one it doesn't answer, nothing yet.
   */
  answers(query: string): boolean;
}

const NOTHING: SearchResults = {
  words: [],
  corrections: [],
  idioms: [],
  synonymRows: [],
  tips: [],
  byMeaning: [],
};

/** The texts Search reads of an Entry, the first the one it is shown and sorted by. */
const textsOf = (entry: Entry): readonly [string, ...string[]] => {
  switch (entry.kind) {
    case 'word':
      return [entry.lemma];
    case 'correction':
      return [entry.nonStandardForm, ...entry.standardEquivalents];
    case 'idiom':
      return [entry.expression];
    case 'synonymRow':
      return [entry.dominant.text, ...entry.members.map(({ text }) => text)];
    case 'tip':
      return [entry.title];
  }
};

/** The texts «За значенням» reads of a Word or a Synonym Row: its Definitions, or all of the row. */
const meaningTextsOf = (entry: Entry): readonly string[] => {
  switch (entry.kind) {
    case 'word':
      return [entry.primaryDefinition, ...entry.extraDefinitions];
    case 'synonymRow':
      return [
        entry.meaning,
        entry.dominant.text,
        ...entry.members.flatMap(({ text, shadeNote }) => (shadeNote ? [text, shadeNote] : [text])),
      ];
    default:
      return [];
  }
};

/** An Entry with the Search keys of its texts. */
interface Keyed<Found extends Entry> {
  readonly entry: Found;
  readonly shown: string;
  readonly keys: readonly string[];
  /** The Search keys of the texts «За значенням» reads. */
  readonly meaningKeys: readonly string[];
}

/** A character that ends a word: anything but a letter, a mark or the apostrophe inside a word. */
const WORD_BREAK = /[^\p{L}\p{M}ʼ]/u;

/**
 * Whether the text, as its Search key, or any of its words starts with the
 * query's key; a word starts after a space, a quote, a bracket or a hyphen.
 */
const matches = (key: string, query: string) =>
  Array.from({ length: key.length }).some(
    (_, index) =>
      key.startsWith(query, index) && (index === 0 || WORD_BREAK.test(key.charAt(index - 1))),
  );

/** Opens Search over the Language Pack and the user's Hidden Entries. */
export function createSearch({
  content,
  edition,
  userState,
}: {
  content: Pick<
    ContentReadPort,
    | 'listWords'
    | 'getEntries'
    | 'listCorrectionIds'
    | 'listIdiomIds'
    | 'listSynonymRowIds'
    | 'listTipIds'
  >;
  edition: Pick<Edition, 'isFeatureEnabled' | 'searchLetters'> & {
    readonly languageTraits: Pick<Edition['languageTraits'], 'sortLocale'>;
  };
  userState: Pick<UserState, 'list'>;
}): Search {
  const keyOf = (text: string) => searchKey(text, edition.searchLetters);
  const collator = new Intl.Collator(edition.languageTraits.sortLocale);

  /** Reads the live Entries once, with their texts' Search keys; a read that fails is tried again. */
  const readKeyedOnce = <Found extends Entry>(read: () => Promise<readonly Found[]>) => {
    let keyed: Promise<readonly Keyed<Found>[]> | undefined;
    return () =>
      (keyed ??= read()
        .then((entries) =>
          entries.map((entry) => {
            const texts = textsOf(entry);
            return {
              entry,
              shown: texts[0],
              keys: texts.map(keyOf),
              meaningKeys: meaningTextsOf(entry).map(keyOf),
            };
          }),
        )
        .catch((error: unknown) => {
          keyed = undefined;
          throw error;
        }));
  };
  /** The live Entries of a kind other than the Word, read by their ids. */
  const entriesOf =
    <Kind extends MixKind>(kind: Kind, listIds: () => Promise<readonly string[]>) =>
    async () =>
      (await content.getEntries(await listIds())).filter(
        (entry): entry is Extract<Entry, { kind: Kind }> => entry.kind === kind,
      );

  const words = readKeyedOnce(() => content.listWords());
  /** The other kinds, each read only while the Edition turns it on. */
  const others = {
    correction: readKeyedOnce(entriesOf('correction', () => content.listCorrectionIds())),
    idiom: readKeyedOnce(entriesOf('idiom', () => content.listIdiomIds())),
    synonymRow: readKeyedOnce(entriesOf('synonymRow', () => content.listSynonymRowIds())),
    tip: readKeyedOnce(entriesOf('tip', () => content.listTipIds())),
  } satisfies Record<MixKind, unknown>;

  const answers = (query: string) =>
    edition.isFeatureEnabled('search') && Array.from(keyOf(query)).length >= SHORTEST_QUERY;

  return {
    answers,
    async search(query) {
      if (!answers(query)) return NOTHING;
      const wanted = keyOf(query);
      const exact = ({ keys }: Keyed<Entry>) => (keys.includes(wanted) ? 0 : 1);
      const group = <Found extends Entry>(
        keyed: readonly Keyed<Found>[],
        hidden: ReadonlyMap<string, string>,
      ) =>
        keyed
          .filter(
            ({ entry, keys }) => !hidden.has(entry.id) && keys.some((key) => matches(key, wanted)),
          )
          .sort((a, b) => exact(a) - exact(b) || collator.compare(a.shown, b.shown))
          .slice(0, GROUP_LIMIT)
          .map(({ entry }) => entry);
      const byMeaning = <Found extends Entry>(
        keyed: readonly Keyed<Found>[],
        hidden: ReadonlyMap<string, string>,
      ) =>
        Array.from(wanted).length < SHORTEST_MEANING_QUERY
          ? []
          : keyed
              .filter(
                ({ entry, meaningKeys }) =>
                  !hidden.has(entry.id) && meaningKeys.some((key) => key.includes(wanted)),
              )
              .sort((a, b) => collator.compare(a.shown, b.shown))
              .slice(0, GROUP_LIMIT)
              .map(({ entry }) => entry);
      const ofKind = <Found extends Entry>(
        kind: MixKind,
        read: () => Promise<readonly Keyed<Found>[]>,
      ) => (edition.isFeatureEnabled(featureOfKind(kind)) ? read() : Promise.resolve([]));

      const [hidden, wordsFound, corrections, idioms, synonymRows, tips] = await Promise.all([
        userState.list(userStateRecords.hiddenEntries),
        words(),
        ofKind('correction', others.correction),
        ofKind('idiom', others.idiom),
        ofKind('synonymRow', others.synonymRow),
        ofKind('tip', others.tip),
      ]);
      return {
        words: group(wordsFound, hidden),
        corrections: group(corrections, hidden),
        idioms: group(idioms, hidden),
        synonymRows: group(synonymRows, hidden),
        tips: group(tips, hidden),
        byMeaning: byMeaning<Word | SynonymRow>([...wordsFound, ...synonymRows], hidden),
      };
    },
  };
}
