import type { Word } from '@slovo/contracts';

import type { Edition } from '../edition/edition';
import type { Entries } from '../entries/entries';
import { todayKey } from '../local-date';
import type { HiddenEntries } from '../mix/hidden-entries';
import type { Clock, Random } from '../ports';
import type { TextComparison } from '../text/text-comparison';
import type { Knowledge } from './knowledge';
import type { KnowledgeMark } from './knowledge-record';
import { meaningQuiz, type MeaningQuiz } from './meaning-quiz';

/** A question of the Due Quiz: a Word due for Review today, its Lemma and its three meanings. */
export interface DueQuestion extends MeaningQuiz {
  readonly wordId: string;
  readonly lemma: string;
}

/**
 * The Due Quiz «Перевір себе» on the «Вчу» list (ADR 0131): the Words due
 * for Review today, each asked as Yesterday asks its Word (ADR 0130).
 */
export interface DueQuiz {
  /**
   * The questions of today, in the order of the «Вчу» list, the nearest
   * Review first: every eligible Word due today or on a day past, not Hidden,
   * that has three distinct meanings; a Word without them is left out. The
   * meanings of a Word keep their order all the local day. None with the
   * `dueQuiz` Feature Switch off. Read afresh on every call.
   */
  questions(): Promise<readonly DueQuestion[]>;
  /**
   * The reader picks the meaning `option` of `question`: the right one marks
   * the Word Known, any other Unknown, as its card's «Знаю» and «Не знаю» do,
   * so it is no longer due today. Resolves the mark, or nothing when the
   * Word is no longer due (answered already) or the option is not one of its
   * meanings.
   */
  answer(question: DueQuestion, option: number): Promise<KnowledgeMark | undefined>;
}

/** Opens the Due Quiz over the Knowledge Marks and the Entries, for the Core composition. */
export function openDueQuiz({
  edition,
  knowledge,
  entries,
  hiddenEntries,
  comparison,
  clock,
  seeded,
}: {
  edition: Pick<Edition, 'isFeatureEnabled'>;
  knowledge: Pick<Knowledge, 'state' | 'set'>;
  entries: Pick<Entries, 'eligibleOfKind' | 'wordsInRarityRange'>;
  hiddenEntries: Pick<HiddenEntries, 'has'>;
  /** The Edition's text comparison, which tells the meanings apart. */
  comparison: Pick<TextComparison, 'key'>;
  clock: Clock;
  /** The random port of a seed, which orders a Word's meanings the same all its day. */
  seeded: (seed: string) => Random;
}): DueQuiz {
  async function questions(): Promise<readonly DueQuestion[]> {
    if (!edition.isFeatureEnabled('dueQuiz')) return [];
    const due = knowledge.state.learning.filter(
      ({ daysUntilReview, row }) => daysUntilReview <= 0 && row.kind === 'word',
    );
    if (due.length === 0) return [];
    const [eligible, underCeiling] = await Promise.all([
      entries.eligibleOfKind('word'),
      entries.wordsInRarityRange(),
    ]);
    if ('refusal' in eligible) return [];
    const wordOf = new Map<string, Word>(
      eligible.entries.flatMap((entry) => (entry.kind === 'word' ? [[entry.id, entry]] : [])),
    );
    const pool = underCeiling.filter((word) => !hiddenEntries.has(word.id));
    const today = todayKey(clock);
    return due.flatMap(({ entryId }) => {
      const word = wordOf.get(entryId);
      if (word === undefined) return [];
      const quiz = meaningQuiz(
        word,
        pool.filter((other) => other.id !== word.id),
        seeded(`dueQuiz:${today}:${word.id}`),
        comparison,
      );
      return quiz === undefined ? [] : [{ wordId: word.id, lemma: word.lemma, ...quiz }];
    });
  }

  async function answer(question: DueQuestion, option: number): Promise<KnowledgeMark | undefined> {
    if (!knowledge.state.due.includes(question.wordId)) return undefined;
    if (!Number.isInteger(option) || option < 0 || option >= question.meanings.length) {
      return undefined;
    }
    const mark: KnowledgeMark = option === question.right ? 'known' : 'unknown';
    await knowledge.set(question.wordId, mark);
    return mark;
  }

  return { questions, answer };
}
