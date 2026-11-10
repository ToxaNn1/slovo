import { RaritySchema, type Mood, type Rarity } from '@slovo/contracts';
import { describe, expect, it } from 'vitest';

import { openComposition, type Composition, type FeatureSwitch, type Feed } from '../index';
import { createMemoryContentPort } from '../testing';
import {
  correction,
  fakeClock,
  idiom,
  seededRandom,
  synonymRow,
  testEdition,
  tip,
  word,
} from '../test-support';
import { createMemoryUserStatePort, openUserState } from '../user-state/user-state';

const many = <T>(count: number, prefix: string, make: (id: string) => T): T[] =>
  Array.from({ length: count }, (_, index) => make(`${prefix}${String(index)}`));

/** Four Words of each rarity; the id names the rarity. */
const RARITIES: readonly Rarity[] = [1, 2, 3, 4, 5];
const words = RARITIES.flatMap((rarity) =>
  many(4, `w${String(rarity)}_`, (id) => word(id, { rarity })),
);
const rarityOf = (id: string): Rarity => RaritySchema.parse(Number(id[1]));

const content = createMemoryContentPort({
  words,
  corrections: many(30, 'c_', (id) => correction(id)),
  idioms: many(30, 'i_', (id) => idiom(id)),
  synonymRows: many(30, 'r_', (id) => synonymRow(id)),
  tips: many(30, 't_', (id) => tip(id)),
});

const mood = (id: string, parameters: Pick<Mood, 'rarityBand' | 'shifts'>): Mood => ({
  id,
  name: id,
  emoji: '🙂',
  reply: id,
  ...parameters,
});
const MOODS: readonly Mood[] = [
  mood('upper', { rarityBand: 'upper', shifts: {} }),
  mood('lower', { rarityBand: 'lower', shifts: {} }),
  mood('brisk', { rarityBand: 'whole', shifts: { correction: 'more', idiom: 'more' } }),
  mood('slow', { rarityBand: 'whole', shifts: { correction: 'less' } }),
];

const KINDS: FeatureSwitch[] = ['corrections', 'idioms', 'synonymRows', 'tips', 'mixKindWeights'];

/** One app run with the Mood check-in and the Rarity Ceiling on, Words alone unless `on` adds kinds. */
async function runApp(on: FeatureSwitch[] = []): Promise<Composition> {
  return openComposition({
    content,
    edition: testEdition({
      isFeatureEnabled: (feature) =>
        ['wordOfTheDay', 'dashboard', 'mood', 'rarityCeiling', ...on].includes(feature),
      moods: MOODS,
      dashboardMoods: MOODS,
    }),
    userState: await openUserState({ port: createMemoryUserStatePort() }),
    clock: fakeClock('2026-11-05T09:00:00+02:00').clock,
    random: seededRandom(1376),
  });
}

/** The Entry ids of the cards until one comes again: every unseen Entry of the Cycle once, in order. */
async function cycleIds(feed: Feed): Promise<string[]> {
  const ids = feed.cards.flatMap((card) =>
    'entryId' in card && card.entryId !== undefined ? [card.entryId] : [],
  );
  for (;;) {
    const id = (await feed.next())?.entryId;
    if (id === undefined || ids.includes(id)) return ids;
    ids.push(id);
  }
}

/** The kinds of the first `count` cards: W, C (Correction), I (Idiom), R (Synonym Row) or T (Tip). */
async function kindsOf(feed: Feed, count: number): Promise<string> {
  for (let step = 0; feed.cards.length < count; step++) {
    if (step > 300) throw new Error(`stuck at ${String(feed.cards.length)} cards`);
    await feed.next();
  }
  const letter = { word: 'W', correction: 'C', idiom: 'I', synonymRow: 'R', tip: 'T' } as const;
  return feed.cards
    .slice(0, count)
    .map((card) => ('entryId' in card && card.entryId !== undefined ? letter[card.kind] : ''))
    .join('');
}

describe('the Feed under a Mood', () => {
  it('puts the upper band first from the next card, then the rest in the Cycle order', async () => {
    const plain = await cycleIds((await runApp()).feed);
    const app = await runApp();
    await app.feed.next();
    await app.feed.next();
    await app.mood.choose('upper');
    // The card the Feed opens on and the two swiped to came before the choice.
    const shown = plain.slice(0, 3);
    expect(app.feed.cards.map((card) => card.entryId)).toEqual(shown);

    const ids = await cycleIds(app.feed);

    const upper = (id: string) => rarityOf(id) >= 4;
    const rest = plain.filter((id) => !shown.includes(id));
    expect(ids).toEqual([...shown, ...rest.filter(upper), ...rest.filter((id) => !upper(id))]);
    expect(ids).toHaveLength(words.length);
  });

  it('never crosses the Rarity Ceiling: under «до 3» the upper band is rarities 2 and 3', async () => {
    const app = await runApp();
    await app.rarityCeiling.set(3);
    await app.mood.choose('upper');

    const rarities = (await cycleIds(app.feed)).map(rarityOf);

    // The card the Feed opened on came before the choice; the band follows it.
    const [first, ...chosen] = rarities;
    const band = chosen.slice(0, first === 1 ? 8 : 7);
    expect(rarities).toHaveLength(12);
    expect(band.every((rarity) => rarity === 2 || rarity === 3)).toBe(true);
    expect(chosen.slice(band.length).every((rarity) => rarity === 1)).toBe(true);
  });

  it('puts the lower band first under «до 5», and under «до 2» the lower band is the whole', async () => {
    const low = await runApp();
    await low.mood.choose('lower');
    const [first, ...chosen] = (await cycleIds(low.feed)).map(rarityOf);
    expect(first).toBe(4);
    expect(chosen.slice(0, 8).every((rarity) => rarity <= 2)).toBe(true);
    expect(chosen.slice(8).every((rarity) => rarity > 2)).toBe(true);

    const plain = await runApp();
    await plain.rarityCeiling.set(2);
    const lower = await runApp();
    await lower.rarityCeiling.set(2);
    await lower.mood.choose('lower');

    const ids = await cycleIds(lower.feed);

    expect(ids).toEqual(await cycleIds(plain.feed));
    expect(ids).toHaveLength(8);
  });

  it('spaces the turns of a `more` kind as «Більше», clamped, and never turns on a kind that is off', async () => {
    const more = await runApp(KINDS);
    await more.mix.setKindWeight('correction', 'more');
    await more.mix.setKindWeight('idiom', 'more');
    const brisk = await runApp(KINDS);
    await brisk.mood.choose('brisk');
    const clamped = await runApp(KINDS);
    await clamped.mix.setKindWeight('correction', 'more');
    await clamped.mood.choose('brisk');

    const expected = await kindsOf(more.feed, 30);
    expect(expected).toContain('C');
    expect(await kindsOf(brisk.feed, 30)).toBe(expected);
    expect(await kindsOf(clamped.feed, 30)).toBe(expected);

    const off = await runApp(KINDS);
    await off.mix.setKind('idiom', false);
    await off.mood.choose('brisk');
    expect(await kindsOf(off.feed, 30)).not.toContain('I');
  });

  it('spaces the turns of a `less` kind as «Менше», clamped at it', async () => {
    const less = await runApp(KINDS);
    await less.mix.setKindWeight('correction', 'less');
    const slow = await runApp(KINDS);
    await slow.mix.setKindWeight('correction', 'less');
    await slow.mood.choose('slow');

    expect(await kindsOf(slow.feed, 30)).toBe(await kindsOf(less.feed, 30));
  });

  it('leaves today’s Feed as it is under yesterday’s Mood, before the day change reaches the check-in', async () => {
    const openDay = async (choose: boolean) => {
      const time = fakeClock('2026-11-05T23:50:00+02:00');
      const app = await openComposition({
        content,
        edition: testEdition({
          isFeatureEnabled: (feature) =>
            ['wordOfTheDay', 'dashboard', 'mood', 'rarityCeiling'].includes(feature),
          moods: MOODS,
          dashboardMoods: MOODS,
        }),
        userState: await openUserState({ port: createMemoryUserStatePort() }),
        clock: time.clock,
        random: seededRandom(1376),
      });
      if (choose) await app.mood.choose('upper');
      time.set('2026-11-06T00:10:00+02:00');
      return app;
    };
    const plain = await openDay(false);
    const yesterday = await openDay(true);

    const ids = await cycleIds(yesterday.feed);

    expect(ids).toEqual(await cycleIds(plain.feed));
    expect(ids).toHaveLength(words.length);
  });

  it('without a Mood shows today’s Feed card for card, asked or skipped', async () => {
    const off = await openComposition({
      content,
      edition: testEdition({ isFeatureEnabled: (feature) => KINDS.includes(feature) }),
      userState: await openUserState({ port: createMemoryUserStatePort() }),
      clock: fakeClock('2026-11-05T09:00:00+02:00').clock,
      random: seededRandom(1376),
    });
    const asking = await runApp(KINDS);
    const skipped = await runApp(KINDS);
    await skipped.mood.skip();

    const expected = await cycleIds(off.feed);
    expect(await cycleIds(asking.feed)).toEqual(expected);
    expect(await cycleIds(skipped.feed)).toEqual(expected);
  });
});
