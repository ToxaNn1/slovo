import type { CounterEvent, QuestionnaireQuestion } from '@slovo/contracts';

import type { EditionRegistry, NotServing } from '../edition/edition-registry';
import type { Clock, CommunityWord, CounterStore, EntryCounts, RateLimits } from '../ports';
import { countRequest, ipSubject, type TooManyRequests } from '../rate-limit';
import { isoWeekOf } from './iso-week';

/** The counter events one IP address may send in a day, each event of a batch counting (ADR 0060). */
const EVENTS_PER_IP = { requests: 500, windowSeconds: 24 * 60 * 60 } as const;

/** The questionnaire answers one IP address may send in a day (ADR 0068). */
const ANSWERS_PER_IP = { requests: 100, windowSeconds: 24 * 60 * 60 } as const;

/** What an answer that is not an option of the Edition's question gets. */
export interface UnknownAnswer {
  readonly ok: false;
  readonly reason: 'unknown-answer';
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** The Community Counters readers' devices send their changes to (ADR 0060). */
export interface CommunityCounters {
  /**
   * Adds the events' deltas to the Edition's counts, and each saved +1 to the
   * Entry's Favorites adds of the ISO week (UTC) it arrives in, when the
   * Edition serves Community Counters. Their shape is checked where they enter; whether
   * their Entries are in a pack is not. A batch that takes its IP address
   * over the day's limit of events is refused whole; one its Edition doesn't
   * take counts nothing.
   */
  send(
    request: {
      readonly editionId: string;
      readonly events: readonly CounterEvent[];
    },
    ip: string,
  ): Promise<{ readonly ok: true } | NotServing | TooManyRequests>;
  /**
   * The counts of each Entry, in the order asked, when the Edition serves
   * Community Counters; an Entry nobody counted has zeros.
   */
  read(request: {
    readonly editionId: string;
    readonly entryIds: readonly string[];
  }): Promise<{ readonly ok: true; readonly counters: readonly EntryCounts[] } | NotServing>;
  /**
   * The Community Word of the Edition, when it serves both the Community
   * Counters and the Community Word: the
   * Entry most added to Favorites in the last full ISO week (UTC), the lower
   * Entry id winning a tie, or none when nobody added anything that week.
   */
  communityWord(
    editionId: string,
  ): Promise<{ readonly ok: true; readonly communityWord: CommunityWord | undefined } | NotServing>;
  /**
   * Adds one to the count of an answer of the onboarding questionnaire, when
   * the Edition serves the questionnaire and the answer is an option of its
   * question (ADR 0068). An answer that takes its IP address over the day's
   * limit counts nothing.
   */
  answer(
    request: {
      readonly editionId: string;
      readonly question: QuestionnaireQuestion;
      readonly answer: string;
    },
    ip: string,
  ): Promise<{ readonly ok: true } | NotServing | UnknownAnswer | TooManyRequests>;
}

export function createCommunityCounters({
  editions,
  store,
  rateLimits,
  clock,
}: {
  editions: EditionRegistry;
  store: CounterStore;
  rateLimits: RateLimits;
  clock: Clock;
}): CommunityCounters {
  return {
    async send({ editionId, events }, ip) {
      const serving = await editions.serving(editionId, 'communityCounters');
      if (!serving.ok) return serving;
      const refused = await countRequest(
        rateLimits,
        `counterEventsPerIp:${ipSubject(ip)}`,
        EVENTS_PER_IP,
        clock.now(),
        events.length,
      );
      if (refused !== undefined) return refused;
      await store.add(editionId, events, isoWeekOf(clock.now()));
      return { ok: true };
    },

    async read({ editionId, entryIds }) {
      const serving = await editions.serving(editionId, 'communityCounters');
      if (!serving.ok) return serving;
      const kept = new Map(
        (await store.read(editionId, entryIds)).map((counts) => [counts.entryId, counts]),
      );
      const counters = entryIds.map(
        (entryId) => kept.get(entryId) ?? { entryId, known: 0, unknown: 0, saved: 0 },
      );
      return { ok: true, counters };
    },

    async communityWord(editionId) {
      // The Community Word is made of the counters' adds, so it goes when they do.
      const counting = await editions.serving(editionId, 'communityCounters');
      if (!counting.ok) return counting;
      const serving = await editions.serving(editionId, 'communityWord');
      if (!serving.ok) return serving;
      const lastWeek = isoWeekOf(new Date(clock.now().getTime() - WEEK_MS));
      return { ok: true, communityWord: await store.mostAdded(editionId, lastWeek) };
    },

    async answer({ editionId, question, answer }, ip) {
      const serving = await editions.serving(editionId, 'questionnaire');
      if (!serving.ok) return serving;
      const options = serving.edition.config.questionnaire[question];
      if (!options.some(({ id }) => id === answer)) return { ok: false, reason: 'unknown-answer' };
      const refused = await countRequest(
        rateLimits,
        `questionnaireAnswersPerIp:${ipSubject(ip)}`,
        ANSWERS_PER_IP,
        clock.now(),
      );
      if (refused !== undefined) return refused;
      await store.addAnswer(editionId, question, answer);
      return { ok: true };
    },
  };
}
