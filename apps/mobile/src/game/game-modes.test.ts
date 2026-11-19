import type { Word } from '@slovo/contracts';
import { openComposition, systemRandom, type Composition, type GameModeOffer } from '@slovo/core';
import {
  createMemoryContentPort,
  testEdition,
  seedUserState,
  type GameHubGroup,
  type GameMode,
} from '@slovo/core/testing';
import { describe, expect, it } from 'vitest';

import { gameModeCard, gameModeGroups, gameModeStrings, gameModeToast } from './game-modes';
import { strings as allStrings } from '../test-support';

const { game: strings } = allStrings;

/** A Word of the test Category, with nothing but what the Game reads. */
const word = (index: number): Word => ({
  kind: 'word',
  id: `w_test${String(index)}`,
  lemma: `test${String(index)}`,
  stress: [0],
  partOfSpeech: 'noun',
  primaryDefinition: `The meaning of test${String(index)}.`,
  extraDefinitions: [],
  examples: [],
  synonyms: [],
  antonyms: [],
  registers: [],
  categoryId: 'test',
  rarity: 3,
  sources: [{ title: 'Test source' }],
  correctionIds: [],
  retired: false,
});

/** A Game Mode an Edition would register, which the Edition gives no strings. */
const unnamedMode: GameMode = {
  id: 'test-unnamed',
  entryKind: 'word',
  group: 'new',
  isOn: () => true,
  buildRound: () => undefined,
};

/** Waits until the Game has planned its offers, which it does once the composition is open. */
async function offersPlanned(app: Composition): Promise<Composition> {
  const planning = () => app.game.state.modes.some((offer) => 'planning' in offer);
  if (planning()) {
    await new Promise<void>((resolve) => {
      const stop = app.game.subscribe(() => {
        if (planning()) return;
        stop();
        resolve();
      });
    });
  }
  return app;
}

/** The composition with every Feature Switch on, the Game and Corrections among them, over as many Words. */
async function open({
  words,
  correctionsInMix = true,
  gameModes,
  switchedOff = [],
  marksStress = false,
}: {
  words: number;
  /** Whether the Edition's language marks Stress, which «Наголос» needs. */
  marksStress?: boolean;
  correctionsInMix?: boolean;
  gameModes?: readonly GameMode[];
  /** The Feature Switches turned off; every other one is on. */
  switchedOff?: readonly string[];
}): Promise<Composition> {
  const app = await openComposition({
    content: createMemoryContentPort({ words: Array.from({ length: words }, (_, i) => word(i)) }),
    edition: testEdition({
      isFeatureEnabled: (feature) => !switchedOff.includes(feature),
      userSettingDefaults: { mix: { kinds: { correction: correctionsInMix } } },
      ...(marksStress ? { languageTraits: { stress: { marked: true, vowels: ['e'] } } } : {}),
    }),
    userState: await seedUserState(),
    clock: { now: () => new Date('2026-10-15T09:00:00Z'), timeZone: () => 'Europe/Kyiv' },
    random: systemRandom,
    ...(gameModes === undefined ? {} : { gameModes }),
  });
  return offersPlanned(app);
}

/** The cards of the modes on offer, as the Game screen shows them. */
const cardsOf = ({ game }: Composition) =>
  game.state.modes.map((offer) => gameModeCard(offer, strings));

const guessWordCard = {
  glyph: 'Д?',
  title: 'Вгадай слово',
  line: 'Визначення є. Яке це слово?',
};
const correctionCard = {
  glyph: '?!',
  title: 'Обери правильне',
  line: 'Як кажуть українською',
};

describe('the card of each Game Mode on offer', () => {
  it('draws a mode that can start with its texts and no refusal', async () => {
    const [guessWord] = cardsOf(await open({ words: 15 }));

    expect(guessWord).toEqual({
      ...guessWordCard,
      canStart: true,
      refusal: undefined,
      best: 'Ще жодної гри',
      bestLabel: 'Ще жодної гри',
    });
  });

  it("draws a mode still planned as one that can't start yet, with no refusal", () => {
    const card = gameModeCard(
      { modeId: 'guess-word', entryKind: 'word', group: 'lead', canStart: false, planning: true },
      strings,
    );

    expect(card).toEqual({
      ...guessWordCard,
      canStart: false,
      refusal: undefined,
      best: 'Ще жодної гри',
      bestLabel: 'Ще жодної гри',
    });
  });

  it("says why a mode can't start, in its own text for each refusal", async () => {
    const tooFew = cardsOf(await open({ words: 14 }));
    const outOfMix = cardsOf(await open({ words: 14, correctionsInMix: false }));

    expect(tooFew.slice(0, 2)).toEqual([
      {
        ...guessWordCard,
        canStart: false,
        refusal:
          'Цьому режиму бракує слів і висловів. Поверни категорії в Налаштуваннях, розділ «Мій Мікс».',
        best: 'Ще жодної гри',
        bestLabel: 'Ще жодної гри',
      },
      {
        ...correctionCard,
        canStart: false,
        refusal:
          'Цьому режиму бракує виправлень. Поверни категорії виправлень у Налаштуваннях, розділ «Мій Мікс».',
        best: 'Ще жодної гри',
        bestLabel: 'Ще жодної гри',
      },
    ]);
    expect(outOfMix[1]).toEqual({
      ...correctionCard,
      canStart: false,
      refusal: 'Виправлення вимкнено. Увімкни їх у Налаштуваннях, розділ «Мій Мікс».',
      best: 'Ще жодної гри',
      bestLabel: 'Ще жодної гри',
    });
  });

  it.each([
    [{ result: 12, of: 15 }, 'Рекорд: 12 з 15'],
    [{ result: 23 }, 'Рекорд: 23'],
    [undefined, 'Ще жодної гри'],
  ])('shows the Best result %j as «%s», read the same', (best, text) => {
    const card = gameModeCard(
      {
        modeId: 'stress',
        entryKind: 'word',
        group: 'sound',
        canStart: true,
        ...(best === undefined ? {} : { best }),
      },
      strings,
    );

    expect(card).toEqual({
      glyph: 'А́',
      title: 'Наголос',
      line: 'Торкнись наголошеної голосної',
      canStart: true,
      refusal: undefined,
      best: text,
      bestLabel: text,
    });
  });

  it("with the toast, draws a mode that can't start as one that can, with no refusal", async () => {
    const [guessWord] = (await open({ words: 14 })).game.state.modes.map((offer) =>
      gameModeCard(offer, strings, { toast: true }),
    );

    expect(guessWord).toMatchObject({ ...guessWordCard, canStart: true, refusal: undefined });
  });

  it('fails loudly for a registered mode the Edition gives no strings', async () => {
    const app = await open({ words: 15, gameModes: [unnamedMode] });

    expect(app.game.state.modes.map(({ modeId }) => modeId)).toContain('test-unnamed');
    expect(() => app.game.state.modes.map((offer) => gameModeCard(offer, strings))).toThrow(
      'test-unnamed',
    );
  });
});

describe('the label over a Round', () => {
  it.each([
    ['guess-word', 'Визначення'],
    ['correction', 'Як сказати краще?'],
    ['stress', 'Де наголос?'],
    ['pairs', 'Знайди пари'],
    ['anagram', 'Визначення'],
    ['by-letters', 'Визначення'],
    ['type-word', 'Як сказати краще?'],
    ['build-idiom', 'Склади вислів'],
    ['anglicism', 'Як сказати краще?'],
    ['idiom-meaning', 'Що це означає?'],
    ['origin', 'Звідки це слово?'],
    ['survival', 'Твій хід'],
    ['timed', 'Визначення'],
  ])('reads the %s mode’s own label', (modeId, label) => {
    expect(gameModeStrings(strings.modes, modeId).roundLabel).toBe(label);
  });

  it('fails loudly for a mode the Edition gives no strings', () => {
    expect(() => gameModeStrings(strings.modes, 'test-unnamed')).toThrow('test-unnamed');
  });
});

/** An offer of the mode in the group that can't start, for too few Entries in the Mix. */
const stuckOffer = (modeId: string, group: GameHubGroup): GameModeOffer => ({
  modeId,
  entryKind: 'word',
  group,
  canStart: false,
  refusal: 'too-few-entries',
});

/** An offer of the mode in the group that can start, with nothing else on it. */
const offer = (modeId: string, group: GameHubGroup = 'new'): GameModeOffer => ({
  modeId,
  entryKind: 'word',
  group,
  canStart: true,
});

/** The groups as their titles and the ids of their modes, in order. */
const shapeOf = (groups: ReturnType<typeof gameModeGroups>) =>
  groups.map(({ title, offers }) => [title, offers.map(({ modeId }) => modeId)]);

describe("the toast on a mode that can't start", () => {
  const stuck = stuckOffer('pairs', 'meaning');

  it('sends the reader to «Наголос» while it can start', () => {
    const offers = [offer('guess-word', 'lead'), offer('stress', 'sound'), stuck];

    expect(gameModeToast(stuck, offers, strings)).toBe(
      '«Пари» ще розминається. Влучай поки в «Наголос»!',
    );
  });

  it('sends the reader to «Пари» while «Наголос» itself cannot start', () => {
    const stress = stuckOffer('stress', 'sound');
    const offers = [offer('anagram', 'letters'), stress, offer('pairs', 'meaning')];

    expect(gameModeToast(stress, offers, strings)).toBe(
      '«Наголос» ще розминається. Спробуй поки «Пари»!',
    );
  });

  it('sends the reader to the first mode that can start while neither «Наголос» nor «Пари» can', () => {
    const offers = [
      stuckOffer('stress', 'sound'),
      stuck,
      offer('anagram', 'letters'),
      offer('timed', 'speed'),
    ];

    expect(gameModeToast(stuck, offers, strings)).toBe(
      '«Пари» ще розминається. Спробуй поки «Анаграми»!',
    );
  });
});

/** «Вгадай слово» in the leading row, with no title, then the board's five groups with every mode in its own. */
const HUB_GROUPS = [
  [undefined, ['guess-word']],
  ['Звук', ['stress']],
  ['Значення', ['correction', 'pairs', 'idiom-meaning']],
  ['Букви', ['anagram']],
  ['Швидкість', ['timed']],
  ['Нове', ['by-letters', 'type-word', 'origin', 'anglicism', 'build-idiom', 'survival']],
];

describe('the groups of the modes on offer', () => {
  it('puts every mode in the group it declares, the groups in the agreed order and the modes in the order offered', () => {
    const offers = [
      offer('timed', 'speed'),
      offer('build-idiom'),
      offer('anagram', 'letters'),
      offer('origin'),
      offer('idiom-meaning', 'meaning'),
      offer('stress', 'sound'),
      offer('correction', 'meaning'),
      offer('guess-word', 'lead'),
    ];

    expect(shapeOf(gameModeGroups(offers, strings))).toEqual([
      [undefined, ['guess-word']],
      ['Звук', ['stress']],
      ['Значення', ['idiom-meaning', 'correction']],
      ['Букви', ['anagram']],
      ['Швидкість', ['timed']],
      ['Нове', ['build-idiom', 'origin']],
    ]);
  });

  it("puts every mode on offer in the board's five groups, in the board's order", async () => {
    const app = await open({ words: 15, marksStress: true });

    expect(shapeOf(gameModeGroups(app.game.state.modes, strings))).toEqual(HUB_GROUPS);
  });

  it('lists only the modes the Core offers, and no group without one', async () => {
    const app = await open({ words: 15 });

    expect(shapeOf(gameModeGroups(app.game.state.modes, strings))).toEqual([
      [undefined, ['guess-word']],
      ['Значення', ['correction', 'pairs', 'idiom-meaning']],
      ['Букви', ['anagram']],
      ['Швидкість', ['timed']],
      [
        'Нове',
        ['guess-word', 'by-letters', 'type-word', 'origin', 'anglicism', 'build-idiom', 'survival'],
      ],
    ]);
  });

  it('leaves out a mode the Edition switches off', async () => {
    const app = await open({ words: 15, switchedOff: ['corrections'] });

    expect(shapeOf(gameModeGroups(app.game.state.modes, strings))).toEqual([
      [undefined, ['guess-word']],
      ['Значення', ['pairs', 'idiom-meaning']],
      ['Букви', ['anagram']],
      ['Швидкість', ['timed']],
      ['Нове', ['by-letters', 'origin', 'build-idiom']],
    ]);
  });

  it('puts a Game Mode added only in the Core under the group its offer names', () => {
    expect(
      shapeOf(gameModeGroups([offer('guess-word', 'lead'), offer('test-new', 'letters')], strings)),
    ).toEqual([
      [undefined, ['guess-word']],
      ['Букви', ['test-new']],
    ]);
  });
});
