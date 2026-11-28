import type { AskableEntry, Entries } from '../entries/entries';
import type { Knowledge } from '../knowledge/knowledge';
import type { Random } from '../ports';
import { writeStaged } from '../user-state/staged-write';
import type { UserState } from '../user-state/user-state';
import { shuffled } from '../shuffled';
import { markAnswer } from './answer-mark';
import { pickForm, type PickAnswer, type PickRound as PickShown } from './pick-form';
import type { GameEdition, GameMode, RoundContent, RoundLabelKind, TextRange } from './game-mode';
import { WORD_MEANING_ID, asksWordMeaning, wordMeaningRound } from './word-meaning';
import type { GameXp } from './game-xp';
import type { TextComparison } from '../text/text-comparison';

/** A Round the reader answers by picking one of its options, as a Game Mode builds it. */
type PickRound = Extract<RoundContent, { readonly form: 'pick' }>;

/**
 * A Quick Question's Round as the reader sees it before the pick: the right
 * option and the sheet that names it kept out, as a Game's Round keeps them.
 */
export type QuickQuestionRound = PickShown & {
  readonly prompt: string;
  /** The part of the prompt to mark; none to mark. */
  readonly highlight: TextRange | undefined;
  /** The gap in the prompt, where the Lemma of an Example stands; none in another Round. */
  readonly gap: TextRange | undefined;
  /** Which label the Round shows over its prompt: the Game Mode's, or its own kind's. */
  readonly labelKind: RoundLabelKind;
  /** The Definition shown under the prompt; none when left out. */
  readonly definition: string | undefined;
  /** The non-standard form a Tip's question replaces, shown under it; none for another Entry. */
  readonly nonStandardForm: string | undefined;
};

/** A Quick Question's pick judged by its Answer Form, with the Entry it asked about, whose Definition the answer card explains it with. */
export type QuickQuestionAnswer = PickAnswer & { readonly entry: AskableEntry };

/** A Quick Question as the reader is asked it: where it came from, its Round and, once picked, the answer judged. */
export interface AskedQuickQuestion {
  readonly source: QuickQuestionSource;
  readonly round: QuickQuestionRound;
  readonly answer: QuickQuestionAnswer | undefined;
}

/**
 * Where a Quick Question's Round came from: a Game Mode on offer, named by
 * its id, or the Word Meaning question, which is no Game Mode.
 */
export type QuickQuestionSource =
  { readonly kind: 'game-mode'; readonly modeId: string } | { readonly kind: 'word-meaning' };

/** What a Quick Question asks: one pick Round over an Eligible Entry, and where it came from. */
export interface QuickQuestionContent {
  /** The Entry the Round asks about, which its answer marks and whose Definition the answer card explains it with, as the Game's does. */
  readonly entry: AskableEntry;
  readonly source: QuickQuestionSource;
  readonly round: PickRound;
}

/** The stable id of where a Quick Question came from: the Game Mode's own, or the Word Meaning question's. */
export const quickQuestionSourceId = (source: QuickQuestionSource): string =>
  source.kind === 'game-mode' ? source.modeId : WORD_MEANING_ID;

/**
 * The most characters a Quick Question prompt may hold: a Feed card fits no
 * longer one, so an Entry whose prompt runs past it is not asked.
 */
const QUICK_QUESTION_PROMPT_LIMIT = 140;

/**
 * The Quick Question (CONTEXT.md): it builds one Round from an enabled Game
 * Mode or a Word Meaning question over an Eligible Entry, and keeps the
 * reader's answer. A right answer earns its XP and confirms the Entry (ADR 0066); a wrong one marks the Entry Unknown.
 */
export interface QuickQuestion {
  /**
   * A Round of a Game Mode on offer or of the Word Meaning question while its
   * Feature Switch is on, tried in one random order so each has
   * the same chance, over a random Eligible Entry other than `avoid`; only a
   * mode whose Round is a pick of options with a prompt of at most
   * `QUICK_QUESTION_PROMPT_LIMIT` characters can give one. Nothing when none can.
   */
  build(avoid?: string): Promise<AskedQuickQuestion | undefined>;
  /**
   * Judges the option the reader picked by the pick form, keeps it and
   * resolves the question answered. A question is answered once: nothing when
   * it was answered already or not built here, or the Round lacks the option,
   * and then nothing is written.
   */
  answer(question: AskedQuickQuestion, option: number): Promise<AskedQuickQuestion | undefined>;
}

/** What may give a Quick Question: its Round over an Entry other than `avoid`, or nothing. */
type Candidate = (avoid?: string) => Promise<QuickQuestionContent | undefined>;

export function createQuickQuestion({
  edition,
  comparison,
  entries,
  knowledge,
  xp,
  userState,
  random,
  modes: registered,
  answered,
}: {
  edition: GameEdition;
  /** The Edition's text comparison, built once by the composition. */
  comparison: TextComparison;
  entries: Pick<Entries, 'eligibleOfKind'>;
  knowledge: Pick<Knowledge, 'answer' | 'confirm'>;
  xp: GameXp;
  userState: Pick<UserState, 'write'>;
  random: Random;
  modes: readonly GameMode[];
  /** Tells of the reader's answer to the question, right or not; it never throws. */
  answered?: (content: QuickQuestionContent, right: boolean) => Promise<void>;
}): QuickQuestion {
  const ofMode =
    (mode: GameMode): Candidate =>
    async (avoid) => {
      const eligible = await entries.eligibleOfKind(mode.entryKind, mode.alsoAsks);
      if ('refusal' in eligible) return undefined;
      for (const answer of shuffled(
        eligible.entries.filter(({ id }) => id !== avoid),
        random,
      )) {
        const round = mode.buildRound({
          answer,
          eligible: eligible.entries,
          next: [],
          weakNext: new Set(),
          upTo: 1,
          round: 1,
          random,
          edition,
          comparison,
        });
        // An Entry the Game Mode cannot ask gives its place to the next.
        if (round === undefined) continue;
        if (round.form !== 'pick') return undefined;
        if (round.prompt.length <= QUICK_QUESTION_PROMPT_LIMIT)
          return { entry: answer, source: { kind: 'game-mode', modeId: mode.id }, round };
      }
      return undefined;
    };

  const wordMeaning: Candidate = async (avoid) => {
    const eligible = await entries.eligibleOfKind('word');
    if ('refusal' in eligible) return undefined;
    const words = eligible.entries.filter((entry) => entry.kind === 'word');
    // The first that may be asked of a shuffle: the check reads a Definition, so not every Word pays it.
    const answer = shuffled(
      words.filter(({ id }) => id !== avoid),
      random,
    ).find((word) => asksWordMeaning(word, comparison));
    if (answer === undefined) return undefined;
    const round = wordMeaningRound({ answer, eligible: words, random, comparison });
    return round && { entry: answer, source: { kind: 'word-meaning' }, round };
  };

  const candidates: readonly Candidate[] = [
    ...registered.filter((mode) => mode.isOn(edition)).map(ofMode),
    ...(edition.isFeatureEnabled('quickQuestionWordMeaning') ? [wordMeaning] : []),
  ];

  // What each question asked and not answered yet was built from, the right option among it, by its Round.
  const unanswered = new WeakMap<QuickQuestionRound, QuickQuestionContent>();

  async function build(avoid?: string): Promise<AskedQuickQuestion | undefined> {
    for (const candidate of shuffled(candidates, random)) {
      const content = await candidate(avoid);
      if (content === undefined) continue;
      const { entry, round: built } = content;
      // What the reader sees of the Round, named one by one so the right option never slips in.
      const round: QuickQuestionRound = {
        form: built.form,
        options: built.options,
        prompt: built.prompt,
        highlight: built.highlight,
        gap: built.gap,
        labelKind: built.labelKind ?? 'mode',
        definition: built.definition,
        nonStandardForm: entry.kind === 'tip' ? entry.nonStandardForm : undefined,
      };
      unanswered.set(round, content);
      return { source: content.source, round, answer: undefined };
    }
    return undefined;
  }

  async function answer(
    question: AskedQuickQuestion,
    option: number,
  ): Promise<AskedQuickQuestion | undefined> {
    const content = unanswered.get(question.round);
    if (content === undefined || question.answer !== undefined) return undefined;
    // Judged by its Answer Form, as a Game's pick Round is; an option the Round lacks is no answer.
    const judged = pickForm.judge(
      content.round,
      pickForm.shown(content.round, []),
      { form: 'pick', option },
      comparison,
    );
    if (judged === undefined) return undefined;
    unanswered.delete(question.round);
    const { right } = judged.answer;
    if (right) await writeStaged(userState, [xp.award({ source: 'quick-question' })]);
    await markAnswer(knowledge, content.entry.id, right);
    await answered?.(content, right);
    return { ...question, answer: { ...judged.answer, entry: content.entry } };
  }

  return { build, answer };
}
