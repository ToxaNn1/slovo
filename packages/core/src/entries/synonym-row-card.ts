import type { Example, SynonymRow, SynonymRowDominant } from '@slovo/contracts';

import type { Entries } from './entries';
import { renderStress, stressedVowelsOf } from './stress';

/** A word of a Synonym Row as its card shows it: the dominant or a member. */
export interface SynonymRowWordModel {
  /** The text with every Stress mark applied. */
  readonly text: string;
  /** The stressed vowels of the text, in order, as VoiceOver names them. */
  readonly stressedVowels: readonly string[];
  /**
   * The Word of the Language Pack a tap opens, even a Hidden one (ADR 0015);
   * nothing for a word without a Word id or one whose Word is Retired or not
   * in the pack, which shows as plain text (ADR 0051).
   */
  readonly wordId: string | undefined;
}

/** A member of a Synonym Row as its card shows it. */
export interface SynonymRowMemberModel extends SynonymRowWordModel {
  /** The note on the member's shade («кульгаючи»); nothing shows plainly. */
  readonly shadeNote: string | undefined;
}

/**
 * What a Synonym Row card shows, decided by the Core: the UI draws it and
 * never picks sections itself. It carries data and keys only; the UI turns
 * the kind into the Edition's chip «синоніми» (ADR 0051). A section without
 * data is left out: `undefined`.
 */
export interface SynonymRowCardModel {
  readonly kind: 'synonymRow';
  readonly synonymRowId: string;
  readonly dominant: SynonymRowWordModel;
  /** The sense of the dominant the row is about. */
  readonly meaning: string;
  /** The members, in the row's order. */
  readonly members: readonly SynonymRowMemberModel[];
  readonly example: Example | undefined;
  /** The titles of the row's sources, in their order; the card names them in a line. */
  readonly sourceTitles: readonly string[];
}

/** The Synonym Row card of a row, linking only the live Words the Entries give for it. */
export async function buildSynonymRowCard({
  synonymRow,
  entries,
}: {
  synonymRow: SynonymRow;
  entries: Pick<Entries, 'getMany'>;
}): Promise<SynonymRowCardModel> {
  const linkedIds = [synonymRow.dominant, ...synonymRow.members].flatMap(
    ({ wordId }) => wordId ?? [],
  );
  const linked = await entries.getMany(linkedIds);
  const isLiveWord = (id: string) => {
    const entry = linked.get(id);
    return entry?.kind === 'word' && !entry.retired;
  };
  const wordModel = ({ text, stress, wordId }: SynonymRowDominant): SynonymRowWordModel => ({
    text: renderStress({ lemma: text, stress }),
    stressedVowels: stressedVowelsOf({ lemma: text, stress }),
    wordId: wordId !== undefined && isLiveWord(wordId) ? wordId : undefined,
  });
  return {
    kind: 'synonymRow',
    synonymRowId: synonymRow.id,
    dominant: wordModel(synonymRow.dominant),
    meaning: synonymRow.meaning,
    members: synonymRow.members.map((member) => ({
      ...wordModel(member),
      shadeNote: member.shadeNote,
    })),
    example: synonymRow.example,
    sourceTitles: synonymRow.sources.map((source) => source.title),
  };
}
