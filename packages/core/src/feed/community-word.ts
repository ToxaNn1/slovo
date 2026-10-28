import type { Edition } from '../edition/edition';
import type { Entries } from '../entries/entries';
import { dateKeyOf, isMonday, type LocalDate } from '../local-date';
import type { HiddenEntries } from '../mix/hidden-entries';
import type { CommunityWordAnswer, CommunityWordApi } from '../ports';
import type { UserState } from '../user-state/user-state';
import { userStateRecords } from '../user-state/user-state-schema';
import { buildFeedCard } from './feed';
import type { FeedNotices } from './feed-notices';

const { communityWord: kept } = userStateRecords;

/**
 * The Community Word («Слово тижня спільноти»): on a local Monday, the card of
 * the Entry readers most added to Favorites last ISO week, with its adds,
 * while that Entry is in the Language Pack and neither Hidden nor Retired. The
 * week is read once a day: the answer is kept for its local date, and a read
 * that fails is tried again on the next card. It is there only while the
 * Feature Switches `communityCounters` and `communityWord` are both on. Swiping past it closes it for its day
 * (ADR 0060).
 */
export function createCommunityWord({
  edition,
  entries,
  hiddenEntries,
  userState,
  api,
}: {
  edition: Pick<Edition, 'isFeatureEnabled'>;
  entries: Entries;
  hiddenEntries: Pick<HiddenEntries, 'has'>;
  userState: UserState;
  api: CommunityWordApi;
}): FeedNotices {
  /** The Community Word of the day, read once a day; none when there is none or it can't be read. */
  async function ofDay(day: LocalDate): Promise<CommunityWordAnswer | undefined> {
    const date = dateKeyOf(day);
    const keptOfDay = await userState.read(kept);
    if (keptOfDay?.date === date) return keptOfDay.communityWord ?? undefined;
    const answer = await api.communityWord();
    if (!answer.ok) return undefined;
    const communityWord = answer.communityWord ?? null;
    await userState.write(kept.change({ date, communityWord }));
    return answer.communityWord;
  }

  return {
    async forDay(day) {
      const switchedOn =
        edition.isFeatureEnabled('communityCounters') && edition.isFeatureEnabled('communityWord');
      if (!switchedOn || !isMonday(day)) return [];
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
