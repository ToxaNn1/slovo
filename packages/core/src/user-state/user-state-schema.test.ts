import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { checkUserStateRecords, syncMarkOf, userStateRecords } from './user-state-schema';
import {
  declareRecord,
  declareRecords,
  type UserStateRecord,
  type UserStateRecords,
} from './user-state-record';
import { createMemoryUserStatePort, openUserState } from './user-state';

const { activeDays, notificationTimes, notificationSound, notificationPlan, onboardingFinished } =
  userStateRecords;

// Spec #166, "User-state records": each 0.4 record, by its key and the value it keeps.
describe('the 0.4 user-state records', () => {
  it('keeps each record under the key the spec names', () => {
    expect(activeDays.prefix).toBe('activeDays.');
    expect(activeDays.record('2026-10-14').key).toBe('activeDays.2026-10-14');
    expect(notificationTimes.key).toBe('notifications.times');
    expect(notificationSound.key).toBe('notifications.sound');
    expect(notificationPlan.prefix).toBe('notifications.plan.');
    expect(notificationPlan.record('2026-10-14T09:00').key).toBe(
      'notifications.plan.2026-10-14T09:00',
    );
    expect(onboardingFinished.key).toBe('onboarding.finished');
  });

  it('marks the notification times, the sound, the plan and the onboarding finished as staying on the device', () => {
    expect(notificationTimes.sync).toBe('device-only');
    expect(notificationSound.sync).toBe('device-only');
    expect(notificationPlan.sync).toBe('device-only');
    expect(onboardingFinished.sync).toBe('device-only');
  });

  it('marks Active Days as syncing later as a union', () => {
    expect(activeDays.sync).toBe('union');
  });

  it('reads every record as absent before anything is written, with no migration', async () => {
    const userState = await openUserState({ port: createMemoryUserStatePort() });

    expect(await userState.read(notificationTimes)).toBeUndefined();
    expect(await userState.read(notificationSound)).toBeUndefined();
    expect(await userState.read(onboardingFinished)).toBeUndefined();
    expect(await userState.list(activeDays)).toEqual(new Map());
    expect(await userState.list(notificationPlan)).toEqual(new Map());
  });

  it('stores an empty list of times as an empty list, not as an absent record', async () => {
    const records = new Map<string, string>();
    const userState = await openUserState({ port: createMemoryUserStatePort(records) });

    await userState.write(notificationTimes.change([]));

    expect(records.get('notifications.times')).toBe('[]');
    expect(await userState.read(notificationTimes)).toEqual([]);
  });

  it('reads a record that holds no value of its schema as absent', () => {
    expect(notificationTimes.decode('["9:00"]')).toBeUndefined();
    expect(notificationTimes.decode('["09:00","09:00"]')).toBeUndefined();
    expect(
      notificationTimes.decode(
        JSON.stringify(Array.from({ length: 11 }, (_, hour) => `${String(hour + 10)}:00`)),
      ),
    ).toBeUndefined();
    expect(notificationSound.decode('"off"')).toBeUndefined();
    expect(activeDays.record('2026-10-14').decode('false')).toBeUndefined();
    expect(onboardingFinished.decode('"yesterday"')).toBeUndefined();
    expect(notificationPlan.record('2026-10-14T09:00').decode('7')).toBeUndefined();
  });

  it('reads the closed Feed Notices of a day only when each is a Feed Notice', () => {
    const { feedNoticesClosed } = userStateRecords;
    expect(
      feedNoticesClosed.decode('{"date":"2026-10-31","notices":["weeklyRecap","enoughForToday"]}'),
    ).toEqual({ date: '2026-10-31', notices: ['weeklyRecap', 'enoughForToday'] });
    expect(
      feedNoticesClosed.decode('{"date":"2026-10-31","notices":["weeklyRecap","banner"]}'),
    ).toBeUndefined();
  });
});

// Spec #772, "Best result per mode": one Best result per Game Mode.
describe('the 0.8.12 Best result records', () => {
  const { gameBest } = userStateRecords;

  it("keeps each mode's Best result under `game.best.` and its mode id, marked to keep the higher of two values in sync", () => {
    expect(gameBest.record('guess-word').key).toBe('game.best.guess-word');
    expect(gameBest.record('survival').key).toBe('game.best.survival');
    expect(gameBest.sync).toBe('highest');
  });

  it('reads as absent before anything is written', async () => {
    const userState = await openUserState({ port: createMemoryUserStatePort() });

    expect(await userState.read(gameBest.record('guess-word'))).toBeUndefined();
  });

  it('holds any whole number from 0, since a mode with no Round limit has no upper bound, and reads anything else as absent', () => {
    const survival = gameBest.record('survival');
    expect(survival.decode('0')).toBe(0);
    expect(survival.decode('15')).toBe(15);
    expect(survival.decode('230')).toBe(230);
    for (const text of ['-1', '7.5', '"7"', 'null']) {
      expect(survival.decode(text)).toBeUndefined();
    }
  });
});

// Spec #378, "Which records sync": each record's mark, read from the schema by key.
describe('the 0.8 sync marks', () => {
  it('keeps on the device the schema version, the Feed place, the swipe hint, the Word of the Day, vibration, and the 0.4 and 0.7 records that stayed', () => {
    for (const key of [
      'schema.version',
      'feed.position',
      'feed.swipeHintShown',
      'feed.wordOfTheDay',
      'settings.vibration',
      'notifications.times',
      'notifications.sound',
      'notifications.plan.2026-10-18T09:00',
      'onboarding.finished',
      'firstWeek.from',
      'contentUpdate.checkedAt',
      'edition.switches',
      'feed.noticesClosed',
      'search.recentQueries',
      'notifications.titles',
      'game.widgetHintOffered',
      'reports.queue',
    ]) {
      expect(syncMarkOf(key), key).toBe('device-only');
    }
  });

  it('syncs the reader’s settings, words and Feed Cycle by last write wins', () => {
    for (const key of [
      'settings.theme',
      'settings.fontSize',
      'favorites.w_1',
      'collections.k_1',
      'collectionEntries.k_1.w_1',
      'history.w_1',
      'hidden.w_1',
      'mix.categories.nature',
      'mix.correctionCategories.work',
      'mix.corrections',
      'mix.idioms',
      'mix.synonymRows',
      'mix.tips',
      'mix.rarityFloor',
      'feed.cycle',
      'feed.seen.w_1',
      'wordOfTheDayArchive.2026-10-26',
      'settings.dailyLimit',
    ]) {
      expect(syncMarkOf(key), key).toBe('last-write-wins');
    }
  });

  it('keeps every device’s Active Days and the higher Best result of each Game Mode', () => {
    expect(syncMarkOf('activeDays.2026-10-18')).toBe('union');
    expect(syncMarkOf('game.best.guess-word')).toBe('highest');
    expect(syncMarkOf('game.best.timed')).toBe('highest');
  });

  it('no longer knows the single best result of 0.8.11, which a migration carried to «Вгадай слово»', () => {
    expect(syncMarkOf('game.best')).toBeUndefined();
  });

  it('knows no mark for a key the schema does not declare, such as a newer app’s record', () => {
    for (const key of ['streak.frozen', 'feed.seen', 'favorites.', 'settings.theme.dark', '']) {
      expect(syncMarkOf(key), key).toBeUndefined();
    }
  });
});

describe('the registry of the user-state records', () => {
  it('refuses two domains that declare the same name, the same key, or a key under a prefix', () => {
    const theme = { theme: declareRecord('settings.theme', z.string()) };

    expect(() =>
      checkUserStateRecords([theme, { theme: declareRecord('other.theme', z.string()) }]),
    ).toThrow(/"theme"/);
    expect(() =>
      checkUserStateRecords([theme, { look: declareRecord('settings.theme', z.string()) }]),
    ).toThrow(/"theme" and "look"/);
    expect(() =>
      checkUserStateRecords([
        { seen: declareRecords('feed.seen.', z.number()) },
        { one: declareRecord('feed.seen.w-1', z.number()) },
      ]),
    ).toThrow(/"seen" and "one"/);
    expect(() =>
      checkUserStateRecords([
        { seen: declareRecords('feed.seen.', z.number()) },
        { some: declareRecords('feed.seen.w', z.number()) },
      ]),
    ).toThrow(/"seen" and "some"/);
    expect(() =>
      checkUserStateRecords([
        theme,
        { seen: declareRecords('feed.seen.', z.number()) },
        { cycle: declareRecord('feed.cycle', z.number()) },
      ]),
    ).not.toThrow();
  });
});

/**
 * A user state as the 1.0 app kept it: a record of every name the schema
 * declared in 1.0, by its name, the id of a kind of records, the key it is
 * stored under and the text stored.
 */
const storedIn1_0: readonly (readonly [
  keyof typeof userStateRecords,
  string | undefined,
  string,
  string,
])[] = [
  ['schemaVersion', undefined, 'schema.version', '6'],
  ['installed', undefined, 'app.installed', 'true'],
  ['theme', undefined, 'settings.theme', '"dark"'],
  ['fontSize', undefined, 'settings.fontSize', '"L"'],
  ['vibration', undefined, 'settings.vibration', 'false'],
  ['noCounters', undefined, 'settings.hideStreak', 'true'],
  ['selfCheck', undefined, 'settings.selfCheck', 'true'],
  ['seasonalDecor', undefined, 'settings.seasonalDecor', 'false'],
  ['shareCounters', undefined, 'settings.shareCounters', 'false'],
  ['dailyLimit', undefined, 'settings.dailyLimit', '20'],
  ['swipeHintShown', undefined, 'feed.swipeHintShown', 'true'],
  [
    'feedNoticesClosed',
    undefined,
    'feed.noticesClosed',
    '{"date":"2026-10-30","notices":["weeklyRecap"]}',
  ],
  ['levelMilestonesClosed', undefined, 'feed.levelMilestonesClosed', '[5,10]'],
  ['saveProgressOffered', undefined, 'feed.saveProgressOffered', '["2026-10-29"]'],
  [
    'communityWord',
    undefined,
    'feed.communityWord',
    '{"date":"2026-10-30","communityWord":{"entryId":"w-1","adds":12}}',
  ],
  ['recentQueries', undefined, 'search.recentQueries', '["пруг"]'],
  ['feedPosition', undefined, 'feed.position', '{"entryId":"w-2","date":"2026-10-30"}'],
  ['cycle', undefined, 'feed.cycle', '{"id":2,"seed":42}'],
  ['seen', 'w-2', 'feed.seen.w-2', '2'],
  ['wordOfTheDay', undefined, 'feed.wordOfTheDay', '{"entryId":"w-3","date":"2026-10-30"}'],
  ['wordOfTheDayArchive', '2026-10-30', 'wordOfTheDayArchive.2026-10-30', '"w-3"'],
  ['favorites', 'w-1', 'favorites.w-1', '"2026-10-30T08:15:00.000Z"'],
  [
    'collections',
    'c-1',
    'collections.c-1',
    '{"name":"Осінь","createdAt":"2026-10-30T08:15:00.000Z"}',
  ],
  ['collectionEntries', 'c-1.w-1', 'collectionEntries.c-1.w-1', '"2026-10-30T08:15:00.000Z"'],
  ['history', 'w-2', 'history.w-2', '{"seenAt":"2026-10-30T08:15:00.000Z","wordOfTheDay":false}'],
  ['hiddenEntries', 'w-4', 'hidden.w-4', '"2026-10-30T08:15:00.000Z"'],
  [
    'knowledge',
    'w-1',
    'knowledge.w-1',
    '{"mark":"known","step":7,"reviewDay":"2026-11-06","learned":false,"markedAt":"2026-10-30T08:15:00.000Z"}',
  ],
  ['confirmed', 'w-1', 'confirmed.w-1', '"2026-10-30T08:15:00.000Z"'],
  ['mixCategories', 'nature', 'mix.categories.nature', 'false'],
  ['mixCorrectionCategories', 'stress', 'mix.correctionCategories.stress', 'true'],
  ['mixCorrections', undefined, 'mix.corrections', 'true'],
  ['mixIdioms', undefined, 'mix.idioms', 'false'],
  ['mixSynonymRows', undefined, 'mix.synonymRows', 'true'],
  ['mixTips', undefined, 'mix.tips', 'false'],
  ['mixKindWeights', 'idioms', 'mix.kindWeights.idioms', '"more"'],
  ['mixRarityFloor', undefined, 'mix.rarityFloor', '2'],
  ['mixRarityCeiling', undefined, 'mix.rarityCeiling', '4'],
  ['mixQuickQuestion', undefined, 'mix.quickQuestion', '10'],
  ['activeDays', '2026-10-30', 'activeDays.2026-10-30', 'true'],
  [
    'xpLog',
    'x-1',
    'xp.x-1',
    '{"kind":"xp","date":"2026-10-30","at":"2026-10-30T08:15:00.000Z","source":"game-round","amount":5,"mode":"guess-word","rarity":3}',
  ],
  [
    'xpLog',
    'x-2',
    'xp.x-2',
    '{"kind":"break","date":"2026-10-31","at":"2026-10-30T08:15:00.000Z","days":3}',
  ],
  ['streakBrokenReported', undefined, 'progress.streakBrokenReported', '"2026-10-20"'],
  ['notificationTimes', undefined, 'notifications.times', '["09:00","20:30"]'],
  ['notificationSound', undefined, 'notifications.sound', 'false'],
  ['notificationPlan', '2026-10-31T09:00', 'notifications.plan.2026-10-31T09:00', '"w-5"'],
  [
    'notificationTitles',
    undefined,
    'notifications.titles',
    '{"last":1,"planned":{"2026-10-31T09:00":2}}',
  ],
  ['notificationAsk', undefined, 'notifications.ask', '{"step":"reask","date":"2026-10-29"}'],
  ['onboardingFinished', undefined, 'onboarding.finished', '"2026-10-30T08:15:00.000Z"'],
  [
    'laterQuestions',
    undefined,
    'questionnaire.later',
    '{"asked":["dailyGoalChoice"],"date":"2026-10-30","offerRarityTest":true}',
  ],
  ['firstWeekFrom', undefined, 'firstWeek.from', '"2026-10-24"'],
  ['contentUpdateCheckedAt', undefined, 'contentUpdate.checkedAt', '"2026-10-30T08:15:00.000Z"'],
  ['remoteSwitches', undefined, 'edition.switches', '{"off":["game"],"etag":"\\"v1\\""}'],
  ['widgetHintShown', undefined, 'game.widgetHintOffered', 'true'],
  ['gameBest', 'guess-word', 'game.best.guess-word', '11'],
  [
    'crosswordProgress',
    undefined,
    'crossword.progress',
    '{"date":"2026-10-30","letters":{"0,1":"п"}}',
  ],
  [
    'syncPending',
    'settings.theme',
    'sync.pending.settings.theme',
    '{"changedAt":"2026-10-30T08:15:00.000Z","value":"\\"dark\\""}',
  ],
  ['countersCounted', 'w-1', 'counters.counted.w-1', '{"mark":"known","saved":true}'],
  ['countersUnsent', 'w-1', 'counters.unsent.w-1', '{"known":1,"unknown":0,"saved":-1}'],
  [
    'countersRead',
    'w-1',
    'counters.read.w-1',
    '{"readAt":"2026-10-30T08:15:00.000Z","known":3,"unknown":1,"saved":2}',
  ],
  ['syncCursor', undefined, 'sync.cursor', '17'],
  ['syncSyncedAt', undefined, 'sync.syncedAt', '"2026-10-30T08:15:00.000Z"'],
  ['mistakeReportQueue', undefined, 'reports.queue', '[]'],
];

describe('a user state kept by 1.0', () => {
  it('opens with no migration and reads every record back as it was stored', async () => {
    const stored = new Map(storedIn1_0.map(([, , key, text]) => [key, text]));
    const records = new Map(stored);

    const userState = await openUserState({ port: createMemoryUserStatePort(records) });

    expect(records).toEqual(stored);
    for (const [name, id, key, text] of storedIn1_0) {
      const declaration: UserStateRecord<unknown> | UserStateRecords<unknown> =
        userStateRecords[name];
      const record = 'key' in declaration ? declaration : declaration.record(id ?? '');
      expect(record.key, name).toBe(key);
      expect(await userState.read(record), name).toEqual(JSON.parse(text));
    }
    expect(new Set(storedIn1_0.map(([name]) => name))).toEqual(
      new Set(Object.keys(userStateRecords)),
    );
  });
});
