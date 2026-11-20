import { CommunityWordOutputSchema } from '@slovo/contracts';

import type { Edition } from '../edition/edition';
import type { Entries } from '../entries/entries';
import { dateKeyOf, isMonday, type LocalDate } from '../local-date';
import type { HiddenEntries } from '../mix/hidden-entries';
import { answerOf } from '../backend';
import type { Backend, Clock, CommunityWordAnswer } from '../ports';
import type { UserState } from '../user-state/user-state';
import { userStateRecords } from '../user-state-schema';
import { buildFeedCard } from './feed';
import type { FeedNotices } from './feed-notices';

const { communityWord: kept } = userStateRecords;

/**
 * The Community Word («Слово тижня спільноти»): on a local Monday, the card of
 * the Entry readers most added to Favorites last ISO week, with its adds,
 * while that Entry is in the Language Pack and neither Hidden nor Retired. The
 * week is read once a day: the answer is kept for its local date. A read that
 * fails is not tried again in the app run, so no later card of the day waits
 * for a backend that does not answer; the next run asks again. The backend names the week by
 * UTC, so while the UTC date is still before the local one, as just past a
 * local midnight east of UTC, the week is not asked for yet. It is there only
 * while the Feature Switches `communityCounters` and `communityWord` are both
 * on. Swiping past it closes it for its day.
 */
export function createCommunityWord({
  edition,
  entries,
  hiddenEntries,
  userState,
  backend,
  clock,
}: {
  edition: Pick<Edition, 'id' | 'isFeatureEnabled'>;
  entries: Entries;
  hiddenEntries: Pick<HiddenEntries, 'has'>;
  userState: UserState;
  backend: Pick<Backend, 'counters'>;
  clock: Clock;
}): FeedNotices {
  /** The local date whose week this app run asked for and could not read. */
  let unreadOn: string | undefined;

  /** The week as the backend answers it now; none when it can't be read. */
  async function asked(): Promise<{ communityWord: CommunityWordAnswer | null } | undefined> {
    // `counters.communityWord` needs no Account and carries no device id.
    const answer = await answerOf(backend.counters.communityWord({ edition: edition.id }));
    if (!answer.ok) return undefined;
    // The client does not check answers: one out of the contract's shape is unexpected and kept nowhere.
    const parsed = CommunityWordOutputSchema.safeParse(answer.output);
    return parsed.success ? parsed.data : undefined;
  }

  /** The Community Word of the day, read once a day; none when there is none or it can't be read. */
  async function ofDay(day: LocalDate): Promise<CommunityWordAnswer | undefined> {
    const date = dateKeyOf(day);
    const keptOfDay = await userState.read(kept);
    if (keptOfDay?.date === date) return keptOfDay.communityWord ?? undefined;
    if (unreadOn === date || clock.now().toISOString().slice(0, 10) < date) return undefined;
    const read = await asked();
    if (read === undefined) {
      unreadOn = date;
      return undefined;
    }
    const { communityWord } = read;
    await userState.write(kept.change({ date, communityWord }));
    return communityWord ?? undefined;
  }

  return {
    async forDay(day) {
      if (!edition.isFeatureEnabled('communityWord') || !isMonday(day)) return [];
      const communityWord = await ofDay(day);
      if (communityWord === undefined || hiddenEntries.has(communityWord.entryId)) return [];
      const { entryId, adds } = communityWord;
      const entry = (await entries.get(entryId)) ?? (await entries.getSynonymRowOrTip(entryId));
      if (entry === undefined || entry.retired) return [];
      const card = await buildFeedCard(entries, entryId);
      return card === undefined ? [] : [{ notice: 'communityWord', card, adds }];
    },
  };
}
