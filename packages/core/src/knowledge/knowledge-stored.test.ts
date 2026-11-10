import { describe, expect, it } from 'vitest';

import { openComposition } from '../index';
import { createFakeNotificationScheduler, createMemoryContentPort } from '../testing';
import { fakeClock, testEdition, word } from '../test-support';
import { createMemoryUserStatePort, openUserState } from '../user-state/user-state';

const content = createMemoryContentPort({
  categories: [{ id: 'test', displayName: 'Test', description: 'Test.', tone: 'loud' }],
  words: Array.from({ length: 20 }, (_, index) => word(`w_${String(index).padStart(2, '0')}`)),
});

/** The Core composition over the stored records, on the local day 2026-10-14. */
async function open(stored: Record<string, string>) {
  const records = new Map(Object.entries(stored));
  const time = fakeClock('2026-10-14T08:00:00+03:00');
  const app = await openComposition({
    content,
    edition: testEdition({
      isFeatureEnabled: () => true,
      userSettingDefaults: {
        notificationTimes: ['09:00', '13:00', '19:00'],
        mix: { categoryIds: ['test'] },
      },
    }),
    userState: await openUserState({ port: createMemoryUserStatePort(records) }),
    clock: time.clock,
    random: { next: () => 0.25 },
    scheduling: {
      scheduler: createFakeNotificationScheduler(),
      ellipsis: '…',
      titles: ['{word}'],
      farewell: 'Farewell',
      streakWarning: 'Streak warning',
      goalNotMet: 'Goal not met',
    },
  });
  return { knowledge: app.knowledge, records };
}

/** The ids of the Entries the reader is learning, by the next Review day. */
const learningIds = (knowledge: Awaited<ReturnType<typeof open>>['knowledge']) =>
  knowledge.state.learning.map(({ entryId }) => entryId);

describe('the Knowledge Marks kept in the user state', () => {
  const learnedBefore0813 = '{"mark":"known","step":null,"reviewDay":null,"learned":true}';
  const reviewOf7 =
    '{"mark":"known","step":7,"reviewDay":"2026-10-20","learned":false,"markedAt":"2026-10-13T10:00:00.000Z"}';
  const unknownBefore0813 = '{"mark":"unknown","step":1,"reviewDay":"2026-10-14","learned":false}';

  it('reads the Learned and the in-Review records kept before, those without a mark time too', async () => {
    const { knowledge } = await open({
      'knowledge.w_01': learnedBefore0813,
      'knowledge.w_02': reviewOf7,
      'knowledge.w_03': unknownBefore0813,
    });

    expect(knowledge.state.shown).toEqual(
      new Map([
        ['w_01', 'known'],
        ['w_02', 'known'],
        ['w_03', 'review'],
      ]),
    );
    expect(knowledge.state.due).toEqual(['w_03']);
    expect(knowledge.state.learning.map((entry) => [entry.entryId, entry.daysUntilReview])).toEqual(
      [
        ['w_03', 0],
        ['w_02', 6],
      ],
    );
  });

  it('writes a record kept before back as the bytes it had', async () => {
    const stored = {
      'knowledge.w_01': learnedBefore0813,
      'knowledge.w_02': reviewOf7,
      'knowledge.w_03': unknownBefore0813,
    };
    const { knowledge, records } = await open(stored);

    for (const entryId of ['w_01', 'w_02']) {
      const kept = records.get(`knowledge.${entryId}`);
      await knowledge.set(entryId, 'unknown');
      expect(records.get(`knowledge.${entryId}`)).not.toBe(kept);
      await knowledge.undo();
    }
    await knowledge.set('w_03', 'known');
    await knowledge.undo();

    expect(
      Object.fromEntries([...records].filter(([key]) => key.startsWith('knowledge.'))),
    ).toEqual(stored);
  });

  it('keeps a new mark in the bytes it had before', async () => {
    const { knowledge, records } = await open({});

    await knowledge.set('w_04', 'known');
    await knowledge.set('w_05', 'unknown');
    await knowledge.answer('w_05', 'known');

    expect(records.get('knowledge.w_04')).toBe(
      '{"mark":"known","step":null,"reviewDay":null,"learned":true,"markedAt":"2026-10-14T05:00:00.000Z"}',
    );
    expect(records.get('knowledge.w_05')).toBe(
      '{"mark":"known","step":3,"reviewDay":"2026-10-17","learned":false,"markedAt":"2026-10-14T05:00:00.000Z"}',
    );
  });

  describe('a record that is neither Learned nor in Review', () => {
    it('is in Review when it keeps a step and a Review day, whatever it says of Learned', async () => {
      const { knowledge, records } = await open({
        'knowledge.w_01':
          '{"mark":"unknown","step":7,"reviewDay":"2026-10-20","learned":true,"markedAt":"2026-10-13T10:00:00.000Z"}',
      });

      expect(knowledge.state.shown.get('w_01')).toBe('unknown');
      expect(learningIds(knowledge)).toEqual(['w_01']);
      await knowledge.set('w_01', 'known');
      await knowledge.undo();
      expect(records.get('knowledge.w_01')).toBe(
        '{"mark":"unknown","step":7,"reviewDay":"2026-10-20","learned":false,"markedAt":"2026-10-13T10:00:00.000Z"}',
      );
    });

    it('is Learned when it is Known without a whole Review', async () => {
      const { knowledge, records } = await open({
        'knowledge.w_01': '{"mark":"known","step":3,"reviewDay":null,"learned":false}',
        'knowledge.w_02': '{"mark":"known","step":null,"reviewDay":"2026-10-14","learned":false}',
      });

      expect(knowledge.state.shown).toEqual(
        new Map([
          ['w_01', 'known'],
          ['w_02', 'known'],
        ]),
      );
      expect(knowledge.state.due).toEqual([]);
      expect(learningIds(knowledge)).toEqual([]);
      // A Learned Entry answered Known stays Learned.
      await knowledge.answer('w_01', 'known');
      expect(records.get('knowledge.w_01')).toBe(
        '{"mark":"known","step":null,"reviewDay":null,"learned":true}',
      );
    });

    it('is in Review at 1 day when it is Unknown without a whole Review, due at once without a Review day', async () => {
      const { knowledge } = await open({
        'knowledge.w_01': '{"mark":"unknown","step":null,"reviewDay":null,"learned":false}',
        'knowledge.w_02': '{"mark":"unknown","step":null,"reviewDay":"2026-10-16","learned":true}',
      });

      expect(knowledge.state.shown).toEqual(
        new Map([
          ['w_01', 'review'],
          ['w_02', 'unknown'],
        ]),
      );
      expect(knowledge.state.due).toEqual(['w_01']);
      expect(learningIds(knowledge)).toEqual(['w_01', 'w_02']);
    });

    it('answers Known from 1 day when it was Unknown without a step', async () => {
      const { knowledge, records } = await open({
        'knowledge.w_02': '{"mark":"unknown","step":null,"reviewDay":"2026-10-16","learned":false}',
      });

      await knowledge.answer('w_02', 'known');

      expect(records.get('knowledge.w_02')).toBe(
        '{"mark":"known","step":3,"reviewDay":"2026-10-17","learned":false,"markedAt":"2026-10-14T05:00:00.000Z"}',
      );
    });
  });
});
