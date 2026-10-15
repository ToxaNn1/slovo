import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { EditionStringsSchema, type Word } from '@slovo/contracts';
import {
  createMemoryContentPort,
  createMemoryUserStatePort,
  openComposition,
  openUserState,
  systemRandom,
  type Composition,
  type GameMode,
} from '@slovo/core';
import { describe, expect, it } from 'vitest';

import { gameModeCard, gameModeStrings } from './game-modes';

const { game: strings } = EditionStringsSchema.parse(
  JSON.parse(
    readFileSync(
      fileURLToPath(new URL('../../../editions/uk/strings.json', import.meta.url)),
      'utf8',
    ),
  ),
);

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
}: {
  words: number;
  correctionsInMix?: boolean;
  gameModes?: readonly GameMode[];
}): Promise<Composition> {
  const app = await openComposition({
    content: createMemoryContentPort({ words: Array.from({ length: words }, (_, i) => word(i)) }),
    edition: {
      languageTraits: { distractorRule: 'same-part-of-speech' },
      categories: [{ id: 'test', displayName: 'Test' }],
      userSettingDefaults: {
        mix: { categoryIds: ['test'], corrections: correctionsInMix },
        notificationTimes: [],
      },
      isFeatureEnabled: () => true,
    },
    userState: await openUserState({ port: createMemoryUserStatePort(new Map()) }),
    clock: { now: () => new Date('2026-10-15T09:00:00Z'), timeZone: () => 'Europe/Kyiv' },
    random: systemRandom,
    ...(gameModes === undefined ? {} : { gameModes }),
  });
  return offersPlanned(app);
}

/** The cards of the modes on offer, in the Edition's texts. */
const cardsOf = ({ game }: Composition) =>
  game.state.modes.map((offer) => gameModeCard(offer, strings.modes));

const guessWordCard = {
  entryKind: 'word',
  overline: 'Визначення → слово',
  title: 'Вгадай слово',
  description: 'Читаєте визначення — обираєте одне слово з чотирьох.',
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

    expect(guessWord).toEqual({ ...guessWordCard, canStart: true, refusal: undefined });
  });

  it("draws a mode still planned as one that can't start yet, with no refusal", () => {
    const card = gameModeCard(
      { modeId: 'guess-word', entryKind: 'word', canStart: false, planning: true },
      strings.modes,
    );

    expect(card).toEqual({ ...guessWordCard, canStart: false, refusal: undefined });
  });

  it("says why a mode can't start, in its own text for each refusal", async () => {
    const tooFew = cardsOf(await open({ words: 14 }));
    const outOfMix = cardsOf(await open({ words: 14, correctionsInMix: false }));

    expect(tooFew).toEqual([
      {
        ...guessWordCard,
        canStart: false,
        refusal: 'Замало слів у вашому Міксі. Поверніть кілька категорій у Налаштуваннях.',
      },
      {
        ...correctionCard,
        canStart: false,
        refusal: 'Замало виправлень у вашому Міксі. Поверніть приховані в Налаштуваннях.',
      },
    ]);
    expect(outOfMix[1]).toEqual({
      ...correctionCard,
      canStart: false,
      refusal: 'Виправлень немає у вашому Міксі. Увімкніть їх у Налаштуваннях.',
    });
  });

  it('fails loudly for a registered mode the Edition gives no strings', async () => {
    const app = await open({ words: 15, gameModes: [unnamedMode] });

    expect(app.game.state.modes.map(({ modeId }) => modeId)).toContain('test-unnamed');
    expect(() => cardsOf(app)).toThrow('test-unnamed');
  });
});

describe('the label over a Round', () => {
  it.each([
    ['guess-word', 'Визначення'],
    ['correction', 'Як сказати краще?'],
  ])('reads the %s mode’s own label', (modeId, label) => {
    expect(gameModeStrings(strings.modes, modeId).roundLabel).toBe(label);
  });

  it('fails loudly for a mode the Edition gives no strings', () => {
    expect(() => gameModeStrings(strings.modes, 'test-unnamed')).toThrow('test-unnamed');
  });
});
