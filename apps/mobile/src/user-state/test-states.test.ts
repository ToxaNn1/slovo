import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { CrosswordDay, Word } from '@slovo/contracts';
import {
  openComposition,
  openTrackedUserState,
  totalFor,
  type Clock,
  type Composition,
} from '@slovo/core';
import { createMemoryContentPort } from '@slovo/core/testing';
import { afterAll, describe, expect, it } from 'vitest';

import { ukrainian } from '../test-support';
import { nodeDriver, type NodeDriver } from './node-sqlite-driver';
import { loadTestState, reopenedByTestState, type TestStateName } from './test-states';
import { openSqliteUserState } from './user-state-sqlite';

/** A Monday morning in Kyiv, so the Weekly Recap of the week before is due. */
const clock: Clock = {
  now: () => new Date('2026-10-12T09:00:00+03:00'),
  timeZone: () => 'Europe/Kyiv',
};
const TODAY = '2026-10-12';

function word(index: number): Word {
  return {
    kind: 'word',
    id: `w_${String(index).padStart(2, '0')}`,
    lemma: `слово${String(index)}`,
    stress: [],
    partOfSpeech: 'adverb',
    primaryDefinition: 'A meaning.',
    extraDefinitions: [],
    examples: [],
    synonyms: [],
    antonyms: [],
    registers: [],
    categoryId: 'nature-weather',
    rarity: 3,
    sources: [{ title: 'Test source' }],
    correctionIds: [],
    retired: false,
  };
}

const words = Array.from({ length: 40 }, (_, index) => word(index + 1));
const content = createMemoryContentPort({ words });

/** Today's Daily Crossword: four words across, one per row. */
const crosswordDay: CrosswordDay = {
  date: TODAY,
  words: ['дім', 'сад', 'ліс', 'мак'].map((answer, row) => ({
    entryId: words[row]?.id ?? '',
    answer,
    clue: 'A clue.',
    row,
    column: 0,
    direction: 'across' as const,
  })),
};
const crossword = {
  crosswordDay: (date: string) => Promise.resolve(date === TODAY ? crosswordDay : undefined),
};

const databases: NodeDriver[] = [];
afterAll(() => {
  for (const db of databases) db.close();
});

/** A stored user state in SQLite, as on the device, with something kept before the link. */
async function storedPort() {
  const db = nodeDriver(join(mkdtempSync(join(tmpdir(), 'slovo-test-state-')), 'user-state.db'));
  databases.push(db);
  const port = await openSqliteUserState(db);
  const before = await openTrackedUserState({ port, clock });
  await before.write(new Map([['favorites.w_40', JSON.stringify('2026-10-01T10:00:00.000Z')]]));
  return port;
}

/** The app as it opens after the reload: the Core composition over the stored state the link loaded. */
async function opened(name: TestStateName): Promise<Composition> {
  const port = await storedPort();
  await loadTestState(name, port, { clock, edition: ukrainian, content, crossword });
  return openComposition({
    content,
    crossword,
    edition: ukrainian,
    userState: await openTrackedUserState({ port, clock }),
    clock,
    random: { next: () => 0.25 },
  });
}

const earned = (app: Composition) => app.badges.state.filter((badge) => badge.earned);

describe('a test state loaded from its link', () => {
  it('fresh: the onboarding from its first step, and nothing kept from before', async () => {
    const app = await opened('fresh');

    expect(app.onboarding.state.step?.number).toBe(1);
    expect(app.onboarding.state.step?.kind).toBe('welcome');
    expect(app.favorites.list).toEqual([]);
    expect(app.xpLog.state.total).toBe(0);
  });

  it('day-3-streak: a Streak of 3', async () => {
    const app = await opened('day-3-streak');

    expect(app.onboarding.state.step).toBeUndefined();
    expect(app.progress.state.streak).toBe(3);
  });

  it('streak-lost: no Streak, the Best Streak of the run before', async () => {
    const app = await opened('streak-lost');

    expect(app.progress.state.streak).toBe(0);
    expect(app.progress.state.bestStreak).toBe(10);
  });

  it('streak-frozen: yesterday covered by a Streak freeze, the Streak kept', async () => {
    const app = await opened('streak-frozen');

    expect(app.xpLog.days.frozen.has('2026-10-11')).toBe(true);
    expect(app.progress.state.streak).toBe(5);
  });

  it('level-up: Level 1, one XP short of Level 2', async () => {
    const app = await opened('level-up');

    expect(app.xpLog.state.level?.level).toBe(1);
    expect(app.xpLog.state.total).toBe(totalFor(ukrainian.levels, 2) - 1);
  });

  it('level-7: Level 7', async () => {
    const app = await opened('level-7');

    expect(app.xpLog.state.level?.level).toBe(7);
  });

  it('all-badges: every Badge of the Edition earned', async () => {
    const app = await opened('all-badges');

    expect(app.badges.state.length).toBeGreaterThan(0);
    expect(earned(app)).toHaveLength(app.badges.state.length);
  });

  it('no-badges: progress, but no Badge earned', async () => {
    const app = await opened('no-badges');

    expect(app.progress.state.streak).toBe(2);
    expect(earned(app)).toEqual([]);
  });

  it('reviews-due: five Entries due for Review', async () => {
    const app = await opened('reviews-due');

    expect(app.knowledge.state.due).toHaveLength(5);
  });

  it('cycle-end: one Entry left before the end-of-Cycle card', async () => {
    const app = await opened('cycle-end');
    await app.feed.show(0);

    const kinds = [];
    for (let card = await app.feed.next(); card !== undefined; card = await app.feed.next()) {
      kinds.push(card.kind);
      if (card.kind === 'end-of-cycle' || kinds.length > 5) break;
    }

    expect(kinds).toContain('end-of-cycle');
  });

  it('weekly-recap: the Weekly Recap of last week on a Monday', async () => {
    const app = await opened('weekly-recap');

    const recap = await app.weeklyRecap.of({ year: 2026, month: 10, day: 12 });

    expect(recap).toMatchObject({ seen: 7, saved: 3, known: 4 });
  });

  it('empty-saved: no Favorites, Learning, History or Collections', async () => {
    const app = await opened('empty-saved');

    expect(app.favorites.list).toEqual([]);
    expect(app.knowledge.state.learning).toEqual([]);
    expect(app.history.list).toEqual([]);
    expect(app.collections.list).toEqual([]);
  });

  it('full-saved: Favorites, Learning, History and four Collections', async () => {
    const app = await opened('full-saved');

    expect(app.favorites.list).toHaveLength(12);
    expect(app.knowledge.state.learning).toHaveLength(6);
    expect(app.history.list).toHaveLength(30);
    expect(app.collections.list).toHaveLength(4);
  });

  it("crossword-solved: today's Daily Crossword solved", async () => {
    const app = await opened('crossword-solved');

    expect((await app.openDailyCrossword())?.state.progress).toBe('solved');
    expect(app.xpLog.milestones.crosswords.has(TODAY)).toBe(true);
  });

  it('crossword-7-in-a-row: seven Daily Crosswords solved in a row up to today', async () => {
    const app = await opened('crossword-7-in-a-row');

    expect((await app.openDailyCrossword())?.state.progress).toBe('solved');
    expect(app.xpLog.milestones.crosswords.size).toBe(7);
  });
});

describe('the app reopened by the reload a test state asks for', () => {
  const sources = { clock, edition: ukrainian, content, crossword };

  it('knows it was, once, so the link it reopens with loads nothing again', async () => {
    const port = await storedPort();
    await loadTestState('day-3-streak', port, sources);

    expect(await reopenedByTestState(port)).toBe(true);
    expect(await reopenedByTestState(port)).toBe(false);
  });

  it('was not, when no test state was loaded', async () => {
    expect(await reopenedByTestState(await storedPort())).toBe(false);
  });

  it('leaves the test state as loaded', async () => {
    const port = await storedPort();
    await loadTestState('day-3-streak', port, sources);
    await reopenedByTestState(port);
    const app = await openComposition({
      ...sources,
      userState: await openTrackedUserState({ port, clock }),
      random: { next: () => 0.25 },
    });

    expect(app.progress.state.streak).toBe(3);
    expect(await reopenedByTestState(port)).toBe(false);
  });
});
