import type { Edition } from '../edition/edition';
import type { Entries } from '../entries/entries';
import { buildWordCard } from '../entries/word-card';
import { dateKeyOf, localDateAfter } from '../local-date';
import type { HiddenEntries } from '../mix/hidden-entries';
import type { UserState } from '../user-state/user-state';
import { userStateRecords } from '../user-state/user-state-schema';
import type { FeedNotices } from './feed-notices';

const { wordOfTheDayArchive } = userStateRecords;

/**
 * Yesterday («Пам'ятаєте вчорашнє слово?»): on each local day, the card of
 * the Word of the Day the archive keeps for the day before, while that Word
 * is neither Hidden nor Retired. The archive keeps a Word only once its card
 * was Seen, so the reader Saw it that day. It reads the archive, so it is
 * there only while the Feature Switches `yesterday` and `wordOfTheDayArchive`
 * are both on. Swiping past it closes it for its day (ADR 0054).
 */
export function createYesterday({
  edition,
  entries,
  hiddenEntries,
  userState,
}: {
  edition: Pick<Edition, 'isFeatureEnabled'>;
  entries: Entries;
  hiddenEntries: Pick<HiddenEntries, 'has'>;
  userState: UserState;
}): FeedNotices {
  return {
    async forDay(day) {
      if (!edition.isFeatureEnabled('yesterday')) return [];
      if (!edition.isFeatureEnabled('wordOfTheDayArchive')) return [];
      const dayBefore = dateKeyOf(localDateAfter(day, -1));
      const wordId = await userState.read(wordOfTheDayArchive.record(dayBefore));
      if (wordId === undefined || hiddenEntries.has(wordId)) return [];
      const word = await entries.get(wordId);
      if (word?.kind !== 'word' || word.retired) return [];
      return [{ notice: 'yesterday', word: await buildWordCard({ word, entries }) }];
    },
  };
}
