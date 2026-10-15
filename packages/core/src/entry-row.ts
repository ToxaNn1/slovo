import type { CorrectionType, Entry, Gender, PartOfSpeech, Register } from '@slovo/contracts';

import type { Entries } from './entries';
import { renderStress } from './stress';

/**
 * What one row of a list shows for an Entry (Favorites, and later Collections
 * and History), decided by the Core. It carries data only; the UI adds the
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
    };

/** The row model of an Entry. */
function buildEntryRow(entry: Entry): EntryRowModel {
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
}

export function createEntryRows(entries: Pick<Entries, 'get'>): EntryRows {
  const rows = new Map<string, Promise<EntryRowModel | undefined>>();

  async function read(entryId: string): Promise<EntryRowModel | undefined> {
    try {
      const entry = await entries.get(entryId);
      return entry === undefined ? undefined : buildEntryRow(entry);
    } catch (error) {
      // A failed read is tried again next time.
      rows.delete(entryId);
      throw error;
    }
  }

  return {
    row(entryId) {
      let row = rows.get(entryId);
      if (row === undefined) {
        row = read(entryId);
        rows.set(entryId, row);
      }
      return row;
    },
  };
}
