import { z } from 'zod';

import { declareRecord, declareRecords } from '../user-state/user-state-record';
import { FEED_NOTICES } from '../feed-notice';

/** A card's Entry and the local date it was on screen. */
const EntryOnDateSchema = z.object({ entryId: z.string(), date: z.string() });

/** The records of the Feed. The Cycle and the Word of the Day keep the `feed.` keys from 0.2, when the Feed held them. */
export const feedRecords = {
  /** That the Feed's swipe hint was shown on this device. */
  swipeHintShown: declareRecord('feed.swipeHintShown', z.literal(true), { sync: 'device-only' }),
  /**
   * The Feed Notices the reader swiped past on this device and the local
   * date they are closed for; on another date none is closed (ADR 0054).
   */
  feedNoticesClosed: declareRecord(
    'feed.noticesClosed',
    z.object({ date: z.string(), notices: z.array(z.enum(FEED_NOTICES)) }),
    { sync: 'device-only' },
  ),
  /**
   * The level milestones whose Feed Notice the reader swiped past on this
   * device: each comes from the day its Level is reached until then, once
   * (ADR 0066). It stays on the device like the other closed Feed Notices.
   */
  levelMilestonesClosed: declareRecord(
    'feed.levelMilestonesClosed',
    z.array(z.number().int().positive()),
    { sync: 'device-only' },
  ),
  /**
   * The local dates the save-progress Feed Notice came on, at most two: it
   * comes on no third day (ADR 0066). It stays on the device, which has no
   * Account to sync it while the Notice comes.
   */
  saveProgressOffered: declareRecord('feed.saveProgressOffered', z.array(z.string()).max(2), {
    sync: 'device-only',
  }),
  /**
   * The Community Word the backend answered on the local date `date`, kept so
   * the week is read once a day; `null`, none (ADR 0060). It stays on the
   * device; a new key needs no migration.
   */
  communityWord: declareRecord(
    'feed.communityWord',
    z.object({
      date: z.string(),
      communityWord: z.object({ entryId: z.string(), adds: z.number() }).nullable(),
    }),
    { sync: 'device-only' },
  ),
  /** The card the reader was on last on this device, and the local date they were on it. */
  feedPosition: declareRecord('feed.position', EntryOnDateSchema, { sync: 'device-only' }),
  /** The current Cycle: its number and the seed of its shuffle. */
  cycle: declareRecord(
    'feed.cycle',
    z.object({ id: z.number().int().positive(), seed: z.number().int().nonnegative() }),
  ),
  /**
   * The Entries Seen, one record per Entry, by Entry id: the id of the Cycle
   * it was Seen in. Only the current Cycle's count, so a mark another device
   * kept in an older Cycle never carries into this one.
   */
  seen: declareRecords('feed.seen.', z.number().int().positive()),
  /**
   * The Word of the Day and the local date it belongs to. It stays on the
   * device: it is the Word of the morning notification this device's own plan
   * Reserves (ADR 0021, 0022).
   */
  wordOfTheDay: declareRecord('feed.wordOfTheDay', EntryOnDateSchema, { sync: 'device-only' }),
};
