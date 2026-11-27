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
import { checkEntries, checkMixedScript } from './entries';
import { parseRecord, type AuthoredRecord, type RecordKind } from './parse-record';
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

/**
 * The content set of the records, each located by `fileOf`, `recordFileOf`
 * by default, as a save is checked against it.
 */
export function contentSetOf(
  records: ContentRecords,
  fileOf: (kind: RecordKind, id: string) => string = recordFileOf,
): ContentSet {
  const authored = <T extends { readonly id: string }>(kind: RecordKind, entries: readonly T[]) =>
    entries.map((entry) => ({ file: fileOf(kind, entry.id), entry }));
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
 * checks it. `today` is the day the public domain is judged on.
 */
export function checkContentSet(
  config: EditionConfig,
  set: ContentSet,
  { today }: { today: Date },
): Refusal[] {
  return checkSet(config, set, today, () => true);
}

/** The content rules over the set, the rules of one Entry alone on the Entries whose file `checksFile` takes. */
function checkSet(
  config: EditionConfig,
  set: ContentSet,
  today: Date,
  checksFile: (file: string) => boolean,
): Refusal[] {
  const { words, corrections, idioms, synonymRows, tips, curatedCollections } = set;
  return [
    ...checkEntries(config, words, corrections, idioms, checksFile),
    ...checkMixedScript([...words, ...corrections, ...idioms, ...synonymRows, ...tips], checksFile),
    ...checkSynonymRows(config, words, synonymRows, checksFile),
    ...checkTips(config, tips, checksFile),
    ...checkCuratedCollections(config, curatedCollections, [
      ...words,
      ...corrections,
      ...idioms,
      ...synonymRows,
      ...tips,
    ]),
    ...unknownCrosswordEntries(set.crosswordDays ?? [], [...words, ...corrections]),
    ...checkCrosswordDays(set.crosswordDays),
    ...protectedLiteraryUses(corrections, today),
  ];
}

/** One save of a record: its kind, the id it is saved under and the fields it is saved with. */
export interface RecordWrite {
  readonly kind: RecordKind;
  /** The record's id; a Crossword day's is its date. */
  readonly id: string;
  readonly fields: Readonly<Record<string, unknown>>;
}

/**
 * The days a write is judged on: `today` for the public domain, and
 * `editionDate`, today's date in the Edition's time zone, the day a
 * Crossword day is published on and a Curated Collection given no date
 * is published on.
 */
export interface WriteDates {
  readonly today: Date;
  readonly editionDate: string;
}

/** A write as the content rules judge it: refused by its schema, or parsed with what the rules refuse in it. */
export type CheckedWrite =
  | { readonly parsed: false; readonly refusals: readonly Refusal[] }
  | {
      readonly parsed: true;
      readonly record: AuthoredRecord;
      readonly refusals: readonly Refusal[];
    };

/**
 * Every content rule over one write saved into the current set, as the
 * write API saves it and `pnpm content check` checks it: the fields are
 * parsed under the write's id, then the record takes the place of the one
 * of its id, or joins the set. The refusals of the saved record come back,
 * and those the save newly causes in other records (a retire under a
 * Curated Collection); what the set already broke stays its own.
 */
export function checkWrite(
  config: EditionConfig,
  set: ContentSet,
  { kind, id, fields }: RecordWrite,
  dates: WriteDates,
): CheckedWrite {
  const file = recordFileOf(kind, id);
  const json =
    kind === 'crosswordDay' ? fields : { ...withPublishDate(kind, fields, dates.editionDate), id };
  const parsed = parseRecord(kind, file, json);
  if (!parsed.ok) return { parsed: false, refusals: parsed.refusals };
  return {
    parsed: true,
    record: parsed.record,
    refusals: checkRecord(config, set, parsed.record, dates),
  };
}

/**
 * The writes checked one after another, as the write API saves them in
 * turn: each against the set with every write before it that passed,
 * each answered with its write.
 */
export function checkWrites<W extends RecordWrite>(
  config: EditionConfig,
  set: ContentSet,
  writes: readonly W[],
  dates: WriteDates,
): { readonly write: W; readonly checked: CheckedWrite }[] {
  let current = set;
  return writes.map((write) => {
    const checked = checkWrite(config, current, write, dates);
    if (checked.parsed && checked.refusals.length === 0) {
      current = withRecord(current, checked.record);
    }
    return { write, checked };
  });
}

/** The fields with a Curated Collection's publish date: one given none is published on the Edition's day. */
function withPublishDate(
  kind: RecordKind,
  fields: Readonly<Record<string, unknown>>,
  editionDate: string,
): Readonly<Record<string, unknown>> {
  if (kind !== 'curatedCollection') return fields;
  const publishedOn = fields['publishedOn'];
  return publishedOn === undefined || publishedOn === ''
    ? { ...fields, publishedOn: editionDate }
    : fields;
}

function checkRecord(
  config: EditionConfig,
  set: ContentSet,
  record: AuthoredRecord,
  { today, editionDate }: WriteDates,
): Refusal[] {
  if (record.kind === 'crosswordDay') {
    return checkCrosswordDay(
      set.crosswordDays ?? [],
      record.entry,
      [...set.words, ...set.corrections],
      { file: record.file, today: editionDate },
    );
  }
  // The rules of one Entry alone give the other records what they gave before, so only the record's run.
  const before = new Set(checkSet(config, set, today, () => false).map(keyOf));
  const after = checkSet(config, withRecord(set, record), today, (file) => file === record.file);
  return after.filter((refusal) => refusal.file === record.file || !before.has(keyOf(refusal)));
}

function keyOf({ rule, file, entryId, field }: Refusal): string {
  return JSON.stringify([rule, file, entryId, field]);
}

function withRecord(set: ContentSet, record: AuthoredRecord): ContentSet {
  switch (record.kind) {
    case 'crosswordDay':
      return {
        ...set,
        crosswordDays: [
          ...(set.crosswordDays ?? []).filter(({ date }) => date !== record.entry.date),
          record.entry,
        ].sort((a, b) => a.date.localeCompare(b.date)),
      };
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
