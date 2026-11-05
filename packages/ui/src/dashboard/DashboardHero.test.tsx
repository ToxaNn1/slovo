import type { WordOfTheDayHero } from '@slovo/core';
import { DashboardHero, EditionProvider } from '@slovo/ui';
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { testStrings } from '../test-strings';

const strings = testStrings({
  wordOfTheDay: { shout: 'Catch the word!', reveal: 'Reveal' },
  dashboard: {
    toCard: 'To the card →',
    kicker: 'Word of the day · {day}.{month}',
    subtitle: 'Rare. Fresh. Yours for a day.',
    wordLine: '{stress} · {partOfSpeech}',
    rarity: 'Rarity {rarity}/5',
  },
  wordCard: {
    stress: 'stress on {vowels}',
    stressOr: '{vowels} or',
    partsOfSpeech: { noun: { short: 'n.', full: 'noun' } },
    genders: { feminine: { short: 'f.', full: 'feminine' } },
    partOfSpeechWithGender: '{partOfSpeech}, {gender}',
  },
});

const date = { year: 2026, month: 11, day: 2 };

const unrevealed: WordOfTheDayHero = { state: 'unrevealed', wordId: 'w_harbour', date };

const revealed: WordOfTheDayHero = {
  state: 'revealed',
  wordId: 'w_harbour',
  date,
  lemmaWithStress: 'ha\u0301rbour',
  stressedVowels: ['a'],
  definition: 'A safe place for ships.',
  partOfSpeech: 'noun',
  gender: 'feminine',
  rarity: 4,
};

async function renderHero(hero: WordOfTheDayHero) {
  const handlers = { onReveal: jest.fn(), onToCard: jest.fn() };
  await render(
    <EditionProvider edition={{ locale: 'uk' }} strings={strings}>
      <DashboardHero hero={hero} {...handlers} />
    </EditionProvider>,
  );
  return handlers;
}

describe('DashboardHero', () => {
  it('unrevealed, shouts under the day with «Reveal» and no way to the card', async () => {
    const { onReveal, onToCard } = await renderHero(unrevealed);

    expect(screen.getByText('Word of the day · 2.11')).toBeTruthy();
    expect(screen.getByText('Catch the word!')).toBeTruthy();
    expect(screen.getByText('Rare. Fresh. Yours for a day.')).toBeTruthy();
    expect(screen.queryByText('To the card →')).toBeNull();
    expect(screen.queryByText('A safe place for ships.')).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Reveal' }));

    expect(onReveal).toHaveBeenCalledTimes(1);
    expect(onToCard).not.toHaveBeenCalled();
  });

  it('revealed, shows the Lemma, its Stress and part of speech, its rarity and Definition', async () => {
    const { onToCard } = await renderHero(revealed);

    expect(screen.getByText('Word of the day · 2.11')).toBeTruthy();
    expect(screen.getByTestId('dashboard-hero-lemma')).toHaveTextContent('harbour');
    expect(screen.getByText('ha\u0301rbour · n., f.')).toBeTruthy();
    expect(screen.getByLabelText('Rarity 4/5')).toBeTruthy();
    expect(screen.getAllByTestId('dashboard-hero-rarity-full')).toHaveLength(4);
    expect(screen.getAllByTestId('dashboard-hero-rarity-empty')).toHaveLength(1);
    expect(screen.getByText('A safe place for ships.')).toBeTruthy();
    expect(screen.queryByText('Reveal')).toBeNull();
    expect(screen.queryByText('Catch the word!')).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'To the card →' }));

    expect(onToCard).toHaveBeenCalledTimes(1);
  });
});
