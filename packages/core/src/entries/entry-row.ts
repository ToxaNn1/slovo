import type {
  Correction,
  CorrectionType,
  Gender,
  Idiom,
  IdiomType,
  PartOfSpeech,
  Register,
  Word,
} from '@slovo/contracts';

import type { Entries } from './entries';
import { renderStress } from './stress';

/**
 * What one row of a list shows for an Entry (Favorites, Collections, History,
 * the Hidden screen and the «Вчу» list), decided by the Core. It carries data only; the UI adds the
 * Edition's words and what each screen puts on the right (a date, a kind, a
 * time).
 */
export type EntryRowModel =
  | {
      readonly kind: 'word';
      readonly entryId: string;
      /** What the row leads with: the Lemma with every Stress mark applied. */
      readonly title: string;
      /** The primary Definition, which the row shows on one line. */
      readonly definition: string;
      /** What labels the Word, as codes the UI turns into the Edition's words (the Hidden screen shows them). */
      readonly partOfSpeech: PartOfSpeech;
      /** Only a noun has one. */
      readonly gender?: Gender;
      readonly registers: readonly Register[];
    }
  | {
      readonly kind: 'correction';
      readonly entryId: string;
      /** What the row leads with: the standard equivalent the Correction card puts first. */
      readonly title: string;
      /** The non-standard form the row says it replaces. */
      readonly nonStandardForm: string;
      /** Why the form is non-standard. */
      readonly correctionType: CorrectionType;
    }
  | {
      readonly kind: 'idiom';
      readonly entryId: string;
      /** What the row leads with: the fixed expression, as written. */
      readonly title: string;
      /** What kind of Idiom it is, a key the UI turns into the Edition's word («фразеологізм», «топонім»). */
      readonly idiomType: IdiomType;
      /** The primary Definition, which the row shows on one line. */
      readonly definition: string;
    };

/** The row model of an Entry. */
export function buildEntryRow(entry: Word | Correction | Idiom): EntryRowModel {
  if (entry.kind === 'word') {
    return {
      kind: 'word',
      entryId: entry.id,
      title: renderStress(entry),
      definition: entry.primaryDefinition,
      partOfSpeech: entry.partOfSpeech,
      ...(entry.gender === undefined ? {} : { gender: entry.gender }),
      registers: entry.registers,
    };
  }
  if (entry.kind === 'idiom') {
    return {
      kind: 'idiom',
      entryId: entry.id,
      title: entry.expression,
      idiomType: entry.idiomType,
      definition: entry.primaryDefinition,
    };
  }
  return {
    kind: 'correction',
    entryId: entry.id,
    // The contracts require at least one standard equivalent.
    title: entry.standardEquivalents[0] ?? entry.nonStandardForm,
    nonStandardForm: entry.nonStandardForm,
    correctionType: entry.correctionType,
  };
}

/**
 * The row models of the Entries the user keeps, by id, read once per Entry:
 * the Language Pack is read-only, so a row never changes in an app session.
 */
export interface EntryRows {
  /** The row model of any Entry, Retired or not; nothing for an id the Language Pack doesn't have. */
  row(entryId: string): Promise<EntryRowModel | undefined>;
  /**
   * The row models of the Entries, by id, as `row` gives each, those not read
   * yet read together, so a list opens with a read of each kind rather than
   * one per Entry. An id the Language Pack doesn't have is not in the map.
   */
  rows(entryIds: Iterable<string>): Promise<ReadonlyMap<string, EntryRowModel>>;
}

export function createEntryRows(entries: Pick<Entries, 'getMany'>): EntryRows {
  const kept = new Map<string, Promise<EntryRowModel | undefined>>();

  /** Reads the rows of the Entries together, and keeps each. */
  function read(entryIds: readonly string[]): void {
    const read = entries.getMany(entryIds);
    for (const entryId of entryIds) {
      kept.set(
        entryId,
        read.then(
          (found) => {
            const entry = found.get(entryId);
            return entry === undefined ? undefined : buildEntryRow(entry);
          },
          (error: unknown) => {
            // A failed read is tried again next time.
            kept.delete(entryId);
            throw error;
          },
        ),
      );
    }
  }

  async function rows(entryIds: Iterable<string>): Promise<ReadonlyMap<string, EntryRowModel>> {
    const ids = [...new Set(entryIds)];
    const unread = ids.filter((entryId) => !kept.has(entryId));
    if (unread.length > 0) read(unread);
    const found = new Map<string, EntryRowModel>();
    await Promise.all(
      ids.map(async (entryId) => {
        const row = await kept.get(entryId);
        if (row !== undefined) found.set(entryId, row);
      }),
    );
    return found;
  }

  return {
    async row(entryId) {
      return (await rows([entryId])).get(entryId);
    },
    rows,
  };
}
