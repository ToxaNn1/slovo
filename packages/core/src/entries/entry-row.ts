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
import { renderStress, withoutStress } from './stress';

/** What indexes the Edition's label of a row: a Word's or a Correction's kind, or an Idiom's Idiom Type (ADR 0046). */
export type EntryLabelKey = 'word' | 'correction' | IdiomType;

/** What every row says of its Entry, whatever its kind. */
interface EntryRowText {
  readonly entryId: string;
  /**
   * What the row leads with: a Word's Lemma with every Stress mark applied, a
   * Correction's main standard equivalent, or an Idiom's expression as written.
   */
  readonly title: string;
  /**
   * The line under the title: a Word's or an Idiom's primary Definition, or
   * the non-standard form a Correction replaces.
   */
  readonly secondLine: string;
  /** The key of the row's label in the Edition's words («слово», «виправлення», «фразеологізм», «топонім», «прислів’я»). */
  readonly labelKey: EntryLabelKey;
  /**
   * The title and the second line as VoiceOver reads them: whole words, with
   * no Stress mark, since the voices break a word at the mark.
   */
  readonly spoken: string;
}

/**
 * What one row of a list shows for an Entry (Favorites, Collections, History,
 * the Hidden screen, the «Вчу» list and the widget), decided by the Core: how
 * the Entry is named and read, the same on every surface (ADR 0017). It
 * carries data and keys only; the UI adds the Edition's words and what each
 * screen puts on the right (a date, a kind, a time).
 */
export type EntryRowModel =
  | (EntryRowText & {
      readonly kind: 'word';
      /** What labels the Word, as codes the UI turns into the Edition's words (the Hidden screen shows them). */
      readonly partOfSpeech: PartOfSpeech;
      /** Only a noun has one. */
      readonly gender?: Gender;
      readonly registers: readonly Register[];
    })
  | (EntryRowText & {
      readonly kind: 'correction';
      /** Why the form is non-standard, a key the UI turns into the Edition's word (the Hidden screen shows it). */
      readonly correctionType: CorrectionType;
    })
  | (EntryRowText & { readonly kind: 'idiom' });

/** The texts of a row, as VoiceOver reads them too. */
function rowText(
  entryId: string,
  title: string,
  secondLine: string,
  labelKey: EntryLabelKey,
): EntryRowText {
  return {
    entryId,
    title,
    secondLine,
    labelKey,
    spoken: `${withoutStress(title)}, ${withoutStress(secondLine)}`,
  };
}

/** The row model of an Entry. */
export function buildEntryRow(entry: Word | Correction | Idiom): EntryRowModel {
  if (entry.kind === 'word') {
    return {
      kind: 'word',
      ...rowText(entry.id, renderStress(entry), entry.primaryDefinition, 'word'),
      partOfSpeech: entry.partOfSpeech,
      ...(entry.gender === undefined ? {} : { gender: entry.gender }),
      registers: entry.registers,
    };
  }
  if (entry.kind === 'idiom') {
    return {
      kind: 'idiom',
      ...rowText(entry.id, entry.expression, entry.primaryDefinition, entry.idiomType),
    };
  }
  return {
    kind: 'correction',
    ...rowText(
      entry.id,
      // The contracts require at least one standard equivalent.
      entry.standardEquivalents[0] ?? entry.nonStandardForm,
      entry.nonStandardForm,
      'correction',
    ),
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
