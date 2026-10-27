import type { Word } from '@slovo/contracts';
import {
  createMemoryUserStatePort,
  openComposition,
  openUserState,
  systemRandom,
  type Composition,
  type GameMode,
  type GameModeOffer,
} from '@slovo/core';
import { createMemoryContentPort } from '@slovo/core/testing';
import { describe, expect, it } from 'vitest';

import { gameModeCard, gameModeGroups, gameModeStrings, playedOffers } from './game-modes';
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
}: {
  words: number;
  correctionsInMix?: boolean;
  gameModes?: readonly GameMode[];
  /** The Feature Switches turned off; every other one is on. */
  switchedOff?: readonly string[];
}): Promise<Composition> {
  const app = await openComposition({
    content: createMemoryContentPort({ words: Array.from({ length: words }, (_, i) => word(i)) }),
    edition: {
      id: 'test',
      languageTraits: { distractorRule: 'same-part-of-speech' },
      userSettingDefaults: {
        mix: {
          categoryIds: ['test'],
          correctionCategoryIds: 'all' as const,
          corrections: correctionsInMix,
          idioms: true,
          synonymRows: true,
          tips: true,
        },
        notificationTimes: [],
      },
      isFeatureEnabled: (feature) => !switchedOff.includes(feature),
    },
    userState: await openUserState({ port: createMemoryUserStatePort(new Map()) }),
    clock: { now: () => new Date('2026-10-15T09:00:00Z'), timeZone: () => 'Europe/Kyiv' },
    random: systemRandom,
    ...(gameModes === undefined ? {} : { gameModes }),
  });
  return offersPlanned(app);
}

/** The cards of the modes on offer, in the Edition's texts. */
/** The cards of the modes the app plays, as the Game screen shows them. */
const cardsOf = ({ game }: Composition) =>
  playedOffers(game.state.modes).map((offer) => gameModeCard(offer, strings));

const guessWordCard = {
  entryKind: 'word',
  overline: 'Визначення → слово',
  title: 'Вгадай слово',
  description: 'Читаєте визначення — обираєте одне слово чи вислів з чотирьох.',
  sample: { prompt: '«метушня, безлад»', answer: 'веремі́я' },
};
const correctionCard = {
  entryKind: 'correction',
  overline: 'Виправлення',
  title: 'Обери правильне',
  description: 'У реченні — поширена ненормативна форма. Знайдіть нормативну.',
  sample: { prompt: 'слідуючий', answer: 'наступний' },
};

describe('the card of each Game Mode on offer', () => {
  it('draws a mode that can start with its texts and no refusal', async () => {
    const [guessWord] = cardsOf(await open({ words: 15 }));

    expect(guessWord).toEqual({
      ...guessWordCard,
      canStart: true,
      refusal: undefined,
      best: undefined,
    });
  });

  it("draws a mode still planned as one that can't start yet, with no refusal", () => {
    const card = gameModeCard(
      { modeId: 'guess-word', entryKind: 'word', canStart: false, planning: true },
      strings,
    );

    expect(card).toEqual({
      ...guessWordCard,
      canStart: false,
      refusal: undefined,
      best: undefined,
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
          'Замало слів і висловів у вашому Міксі. Поверніть кілька категорій у Налаштуваннях.',
        best: undefined,
      },
      {
        ...correctionCard,
        canStart: false,
        refusal: 'Замало виправлень у вашому Міксі. Поверніть приховані в Налаштуваннях.',
        best: undefined,
      },
    ]);
    expect(outOfMix[1]).toEqual({
      ...correctionCard,
      canStart: false,
      refusal: 'Виправлень немає у вашому Міксі. Увімкніть їх у Налаштуваннях.',
      best: undefined,
    });
  });

  it.each([
    [{ result: 12, of: 15 }, 'Найкраще: 12 з 15'],
    [{ result: 23 }, 'Найкраще: 23'],
  ])('shows the Best result %j as «%s»', (best, text) => {
    const card = gameModeCard(
      { modeId: 'guess-word', entryKind: 'word', canStart: true, best },
      strings,
    );

    expect(card.best).toBe(text);
  });

  it('fails loudly for a registered mode the Edition gives no strings', async () => {
    const app = await open({ words: 15, gameModes: [unnamedMode] });

    expect(app.game.state.modes.map(({ modeId }) => modeId)).toContain('test-unnamed');
    expect(() => app.game.state.modes.map((offer) => gameModeCard(offer, strings))).toThrow(
      'test-unnamed',
    );
  });
});

describe('the modes the Game screen offers', () => {
  it('keeps the modes the app plays and leaves out one whose screen is still to come', () => {
    const offers = [
      { modeId: 'guess-word', entryKind: 'word', canStart: true },
      { modeId: 'stress', entryKind: 'word', canStart: true },
      { modeId: 'pairs', entryKind: 'word', canStart: true },
      { modeId: 'anagram', entryKind: 'word', canStart: true },
      { modeId: 'by-letters', entryKind: 'word', canStart: true },
      { modeId: 'correction', entryKind: 'correction', canStart: true },
    ] as const;

    expect(playedOffers(offers).map(({ modeId }) => modeId)).toEqual([
      'guess-word',
      'stress',
      'pairs',
      'by-letters',
      'correction',
    ]);
  });
});

describe('the label over a Round', () => {
  it.each([
    ['guess-word', 'Визначення'],
    ['correction', 'Як сказати краще?'],
    ['stress', 'Де наголос?'],
    ['pairs', 'Знайдіть пари'],
    ['by-letters', 'Визначення'],
  ])('reads the %s mode’s own label', (modeId, label) => {
    expect(gameModeStrings(strings.modes, modeId).roundLabel).toBe(label);
  });

  it('fails loudly for a mode the Edition gives no strings', () => {
    expect(() => gameModeStrings(strings.modes, 'test-unnamed')).toThrow('test-unnamed');
  });
});

/** An offer of the mode that can start, with nothing else on it. */
const offer = (modeId: string): GameModeOffer => ({ modeId, entryKind: 'word', canStart: true });

/** The groups as their titles and the ids of their modes, in order. */
const shapeOf = (groups: ReturnType<typeof gameModeGroups>) =>
  groups.map(({ title, offers }) => [title, offers.map(({ modeId }) => modeId)]);

describe('the groups of the modes on offer', () => {
  it('puts every mode in its group, the groups and the modes in the agreed order', () => {
    const shuffled = [
      'timed',
      'build-idiom',
      'anglicism',
      'origin',
      'survival',
      'type-word',
      'idiom-meaning',
      'by-letters',
      'correction',
      'anagram',
      'pairs',
      'stress',
      'guess-word',
    ].map(offer);

    expect(shapeOf(gameModeGroups(shuffled, strings))).toEqual([
      ['Слова', ['guess-word', 'stress', 'pairs', 'anagram', 'by-letters', 'type-word', 'origin']],
      ['Виправлення', ['correction', 'anglicism']],
      ['Вислови', ['idiom-meaning', 'build-idiom']],
      ['Виклик', ['survival', 'timed']],
    ]);
  });

  it('lists only the modes the Core offers, and no group without one', async () => {
    const app = await open({ words: 15 });

    expect(shapeOf(gameModeGroups(playedOffers(app.game.state.modes), strings))).toEqual([
      ['Слова', ['guess-word', 'pairs', 'by-letters']],
      ['Виправлення', ['correction']],
    ]);
  });

  it('leaves out a mode the Edition switches off', async () => {
    const app = await open({ words: 15, switchedOff: ['corrections'] });

    expect(shapeOf(gameModeGroups(playedOffers(app.game.state.modes), strings))).toEqual([
      ['Слова', ['guess-word', 'pairs', 'by-letters']],
    ]);
  });

  it('fails loudly for a mode on offer in no group', () => {
    expect(() => gameModeGroups([offer('guess-word'), offer('test-unnamed')], strings)).toThrow(
      'test-unnamed',
    );
  });
});
