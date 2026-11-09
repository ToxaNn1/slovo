import type {
  Correction,
  CrosswordDay,
  CuratedCollection,
  EditionConfig,
  Idiom,
  SynonymRow,
  Tip,
  Word,
} from '@slovo/contracts';

import { checkCrosswordDay, checkCrosswordDays, unknownCrosswordEntries } from './crossword-days';
import { checkCuratedCollections } from './curated-collections';
import { checkEntries } from './entries';
import type { AuthoredRecord, RecordKind } from './parse-record';
import { protectedLiteraryUses } from './public-domain';
import type { Authored, Refusal } from './refusal';
import { checkSynonymRows } from './synonym-rows';
import { checkTips } from './tips';

/** Every record of an Edition's content that passed its schema, by kind. */
export interface ContentSet {
  readonly words: readonly Authored<Word>[];
  readonly corrections: readonly Authored<Correction>[];
  readonly idioms: readonly Authored<Idiom>[];
  readonly synonymRows: readonly Authored<SynonymRow>[];
  readonly tips: readonly Authored<Tip>[];
  readonly curatedCollections: readonly Authored<CuratedCollection>[];
  /** The crossword days; absent when the Edition has none. */
  readonly crosswordDays?: readonly CrosswordDay[];
  /** The checksum of the crossword days last published; absent when none were. */
  readonly recordedCrosswordDaysChecksum?: string;
}

/** The records of each kind of an Edition's content, each with its id. */
export interface ContentRecords {
  readonly word: readonly Word[];
  readonly correction: readonly Correction[];
  readonly idiom: readonly Idiom[];
  readonly synonymRow: readonly SynonymRow[];
  readonly tip: readonly Tip[];
  readonly curatedCollection: readonly CuratedCollection[];
  readonly crosswordDay: readonly CrosswordDay[];
}

/** Where a record is located in a refusal: `<kind>/<id>`. */
export const recordFileOf = (kind: RecordKind, id: string): string => `${kind}/${id}`;

/** The content set of the records, each located by `recordFileOf`, as a save is checked against it. */
export function contentSetOf(records: ContentRecords): ContentSet {
  const authored = <T extends { readonly id: string }>(kind: RecordKind, entries: readonly T[]) =>
    entries.map((entry) => ({ file: recordFileOf(kind, entry.id), entry }));
  return {
    words: authored('word', records.word),
    corrections: authored('correction', records.correction),
    idioms: authored('idiom', records.idiom),
    synonymRows: authored('synonymRow', records.synonymRow),
    tips: authored('tip', records.tip),
    curatedCollections: authored('curatedCollection', records.curatedCollection),
    crosswordDays: [...records.crosswordDay].sort((a, b) => a.date.localeCompare(b.date)),
  };
}

/**
 * Every content rule over a whole set of records, as a build or an import
 * checks it. `today` is the day the public domain is judged on (ADR 0045).
 */
export function checkContentSet(
  config: EditionConfig,
  set: ContentSet,
  { today }: { today: Date },
): Refusal[] {
  const { words, corrections, idioms, synonymRows, tips, curatedCollections } = set;
  return [
    ...checkEntries(config, words, corrections, idioms),
    ...checkSynonymRows(config, words, synonymRows),
    ...checkTips(config, tips),
    ...checkCuratedCollections(curatedCollections, [
      ...words,
      ...corrections,
      ...idioms,
      ...synonymRows,
      ...tips,
    ]),
    ...unknownCrosswordEntries(set.crosswordDays ?? [], [...words, ...corrections]),
    ...checkCrosswordDays(set.crosswordDays, set.recordedCrosswordDaysChecksum, config.id),
    ...protectedLiteraryUses(corrections, today),
  ];
}

/**
 * Every content rule over one record saved into the current set: the record
 * takes the place of the one of its id, or joins the set. Only the refusals
 * of the saved record come back; what the set already broke stays its own.
 */
export function checkRecord(
  config: EditionConfig,
  set: ContentSet,
  record: AuthoredRecord,
  options: { today: Date },
): Refusal[] {
  if (record.kind === 'crosswordDay') {
    return checkCrosswordDay(
      set.crosswordDays ?? [],
      record.entry,
      [...set.words, ...set.corrections],
      { file: record.file, today: options.today.toISOString().slice(0, 10) },
    );
  }
  return checkContentSet(config, withRecord(set, record), options).filter(
    ({ file }) => file === record.file,
  );
}

function withRecord(
  set: ContentSet,
  record: Exclude<AuthoredRecord, { kind: 'crosswordDay' }>,
): ContentSet {
  switch (record.kind) {
    case 'word':
      return { ...set, words: replaced(set.words, record) };
    case 'correction':
      return { ...set, corrections: replaced(set.corrections, record) };
    case 'idiom':
      return { ...set, idioms: replaced(set.idioms, record) };
    case 'synonymRow':
      return { ...set, synonymRows: replaced(set.synonymRows, record) };
    case 'tip':
      return { ...set, tips: replaced(set.tips, record) };
    case 'curatedCollection':
      return { ...set, curatedCollections: replaced(set.curatedCollections, record) };
  }
}

/** The records with the one of the record's id replaced by it, or the record added. */
function replaced<T extends { readonly id: string }>(
  records: readonly Authored<T>[],
  { file, entry }: Authored<T>,
): Authored<T>[] {
  return [...records.filter((other) => other.entry.id !== entry.id), { file, entry }];
}
