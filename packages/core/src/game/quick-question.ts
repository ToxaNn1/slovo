import type { Entries } from '../entries/entries';
import type { Knowledge } from '../knowledge/knowledge';
import type { Random } from '../ports';
import type { UserState } from '../user-state/user-state';
import { shuffled } from '../shuffled';
import type { GameEdition, GameMode, RoundContent } from './game-mode';
import type { GameXp } from './game-xp';

/** A Round the reader answers by picking one of its options. */
export type PickRound = Extract<RoundContent, { readonly form: 'pick' }>;

/** What a Quick Question asks: one pick Round of a Game Mode over an Eligible Entry. */
export interface QuickQuestionContent {
  /** The Entry the Round asks about, which its answer marks. */
  readonly askedId: string;
  readonly modeId: string;
  readonly round: PickRound;
}

/**
 * The Quick Question (CONTEXT.md): it builds one Round from an enabled Game
 * Mode over an Eligible Entry, and keeps the reader's answer. A right answer
 * earns its XP and confirms the Entry (ADR 0043, 0066); a wrong one marks
 * the Entry Unknown.
 */
export interface QuickQuestion {
  /**
   * A Round of a Game Mode on offer, the modes tried in a random order, over
   * a random Eligible Entry other than `avoid`; only a mode whose Round is a
   * pick of options can give one. Nothing when no mode can.
   */
  build(avoid?: string): Promise<QuickQuestionContent | undefined>;
  /** Keeps the option the reader picked and resolves whether it is right. */
  answer(content: QuickQuestionContent, option: number): Promise<boolean>;
}

export function createQuickQuestion({
  edition,
  entries,
  knowledge,
  xp,
  userState,
  random,
  modes: registered,
  answered,
}: {
  edition: GameEdition;
  entries: Pick<Entries, 'eligibleOfKind'>;
  knowledge: Pick<Knowledge, 'answer' | 'confirm'>;
  xp: GameXp;
  userState: Pick<UserState, 'write'>;
  random: Random;
  modes: readonly GameMode[];
  /** Tells of the reader's answer about the asked Entry, right or not; it never throws. */
  answered?: (askedId: string, right: boolean) => Promise<void>;
}): QuickQuestion {
  const modes = registered.filter((mode) => mode.isOn(edition));

  async function build(avoid?: string): Promise<QuickQuestionContent | undefined> {
    for (const mode of shuffled(modes, random)) {
      const eligible = await entries.eligibleOfKind(mode.entryKind, mode.alsoAsks);
      if ('refusal' in eligible) continue;
      const answers = eligible.entries.filter(({ id }) => id !== avoid);
      const answer = answers[Math.floor(random.next() * answers.length)];
      if (answer === undefined) continue;
      const round = mode.buildRound({
        answer,
        eligible: eligible.entries,
        next: [],
        upTo: 1,
        round: 1,
        random,
        edition,
      });
      if (round?.form === 'pick') return { askedId: answer.id, modeId: mode.id, round };
    }
    return undefined;
  }

  async function answer(content: QuickQuestionContent, option: number): Promise<boolean> {
    const right = option === content.round.correct;
    if (right) {
      const award = xp.award({ source: 'quick-question' });
      if (award.changes.size > 0) await userState.write(award.changes);
      award.commit();
      await knowledge.confirm(content.askedId);
    } else await knowledge.answer(content.askedId, 'unknown');
    await answered?.(content.askedId, right);
    return right;
  }

  return { build, answer };
}
