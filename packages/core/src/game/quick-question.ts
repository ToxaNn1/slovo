import type { AskableEntry, Entries } from '../entries/entries';
import type { Knowledge } from '../knowledge/knowledge';
import type { Random } from '../ports';
import type { UserState } from '../user-state/user-state';
import { shuffled } from '../shuffled';
import type { GameEdition, GameMode, RoundContent } from './game-mode';
import { WORD_MEANING_ID, asksWordMeaning, wordMeaningRound } from './word-meaning';
import type { GameXp } from './game-xp';
import type { TextComparison } from '../text/text-comparison';

/** A Round the reader answers by picking one of its options. */
export type PickRound = Extract<RoundContent, { readonly form: 'pick' }>;

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
 * The Quick Question (CONTEXT.md): it builds one Round from an enabled Game
 * Mode or a Word Meaning question over an Eligible Entry, and keeps the
 * reader's answer. A right answer earns its XP and confirms the Entry (ADR
 * 0043, 0066); a wrong one marks the Entry Unknown.
 */
export interface QuickQuestion {
  /**
   * A Round of a Game Mode on offer or of the Word Meaning question while its
   * Feature Switch is on (ADR 0127), tried in one random order so each has
   * the same chance, over a random Eligible Entry other than `avoid`; only a
   * mode whose Round is a pick of options can give one. Nothing when none can.
   */
  build(avoid?: string): Promise<QuickQuestionContent | undefined>;
  /** Keeps the option the reader picked and resolves whether it is right. */
  answer(content: QuickQuestionContent, option: number): Promise<boolean>;
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
  /** One of the Entries other than `avoid`, drawn from the random source. */
  const oneOf = <E extends { readonly id: string }>(of: readonly E[], avoid?: string) => {
    const answers = of.filter(({ id }) => id !== avoid);
    return answers[Math.floor(random.next() * answers.length)];
  };

  const ofMode =
    (mode: GameMode): Candidate =>
    async (avoid) => {
      const eligible = await entries.eligibleOfKind(mode.entryKind, mode.alsoAsks);
      if ('refusal' in eligible) return undefined;
      const answer = oneOf(eligible.entries, avoid);
      if (answer === undefined) return undefined;
      const round = mode.buildRound({
        answer,
        eligible: eligible.entries,
        next: [],
        upTo: 1,
        round: 1,
        random,
        edition,
        comparison,
      });
      return round?.form === 'pick'
        ? { entry: answer, source: { kind: 'game-mode', modeId: mode.id }, round }
        : undefined;
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

  async function build(avoid?: string): Promise<QuickQuestionContent | undefined> {
    for (const candidate of shuffled(candidates, random)) {
      const content = await candidate(avoid);
      if (content !== undefined) return content;
    }
    return undefined;
  }

  async function answer(content: QuickQuestionContent, option: number): Promise<boolean> {
    const right = option === content.round.correct;
    if (right) {
      const award = xp.award({ source: 'quick-question' });
      if (award.changes.size > 0) await userState.write(award.changes);
      award.commit();
      await knowledge.confirm(content.entry.id);
    } else await knowledge.answer(content.entry.id, 'unknown');
    await answered?.(content, right);
    return right;
  }

  return { build, answer };
}
