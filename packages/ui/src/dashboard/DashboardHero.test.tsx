import { coreDecor, loadDecor, type Decor, type WordOfTheDayHero } from '@slovo/core';
import {
  DashboardHero,
  DecorProvider,
  EditionProvider,
  InterfaceSoundsProvider,
  ReduceMotionProvider,
} from '@slovo/ui';
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { testStrings } from '../test-strings';
import { typeRoles } from '../tokens';

const strings = testStrings({
  wordOfTheDay: { shout: 'Catch the word!', reveal: 'Reveal' },
  dashboard: {
    reveal: 'Reveal the word',
    toCard: 'To the card →',
    kicker: 'Word of the day · {day}.{month}',
    kickerNumber: 'Word of the day · №{number}',
    subtitle: 'Rare. Fresh. Yours for a day.',
    wordLine: '{stress} · {partOfSpeech}',
    rarity: 'Rarity {rarity} of 5',
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

const unrevealed: WordOfTheDayHero = {
  state: 'unrevealed',
  wordId: 'w_harbour',
  date,
  number: 312,
};

const revealed: WordOfTheDayHero = {
  state: 'revealed',
  wordId: 'w_harbour',
  date,
  number: 312,
  lemmaWithStress: 'ha\u0301rbour',
  stressedVowels: ['a'],
  definition: 'A safe place for ships.',
  partOfSpeech: 'noun',
  gender: 'feminine',
  rarity: 4,
};

/** A Decor whose Mascot has a figure, every part one small rectangle, as an Edition's has. */
const shape = [{ path: 'M0 0h1v1H0z', fill: 'body' }];
const withMascot: Decor = loadDecor({
  mascot: {
    width: 150,
    height: 112,
    pivot: [30, 56],
    figure: shape,
    shine: shape,
    eyes: Object.fromEntries(
      [
        'sleeps',
        'waits',
        'shouts',
        'happy',
        'surprised',
        'cringes',
        'sad',
        'celebrates',
        'hatOff',
      ].map((state) => [state, shape]),
    ),
    hat: shape,
    hatOnGround: shape,
    rays: shape,
    confetti: shape,
    sleepMarks: shape,
  },
});

async function renderHero(
  hero: WordOfTheDayHero,
  {
    sparks = false,
    reduceMotion = false,
    decor = withMascot,
  }: { sparks?: boolean; reduceMotion?: boolean; decor?: Decor } = {},
) {
  const handlers = { onReveal: jest.fn(), onToCard: jest.fn() };
  const play = jest.fn();
  const view = (shown: WordOfTheDayHero) => (
    <ReduceMotionProvider reduceMotion={reduceMotion}>
      <InterfaceSoundsProvider sounds={{ play }}>
        <EditionProvider edition={{ locale: 'uk' }} strings={strings}>
          <DecorProvider decor={decor}>
            <DashboardHero hero={shown} sparks={sparks} {...handlers} />
          </DecorProvider>
        </EditionProvider>
      </InterfaceSoundsProvider>
    </ReduceMotionProvider>
  );
  const { rerender } = await render(view(hero));
  return { ...handlers, play, show: (shown: WordOfTheDayHero) => rerender(view(shown)) };
}

describe('DashboardHero', () => {
  it("unrevealed, shouts under the day's number with «Reveal the word» and no way to the card", async () => {
    const { onReveal, onToCard } = await renderHero(unrevealed);

    expect(screen.getByText('Word of the day · №312')).toBeTruthy();
    expect(screen.queryByText('Word of the day · 2.11')).toBeNull();
    expect(screen.getByText('Catch the word!')).toBeTruthy();
    expect(screen.getByText('Rare. Fresh. Yours for a day.')).toBeTruthy();
    expect(screen.queryByText('To the card →')).toBeNull();
    expect(screen.queryByText('A safe place for ships.')).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Reveal the word' }));

    expect(onReveal).toHaveBeenCalledTimes(1);
    expect(onToCard).not.toHaveBeenCalled();
  });

  it('revealed, shows the Lemma, its Stress and part of speech, its rarity and Definition', async () => {
    const { onToCard } = await renderHero(revealed);

    expect(screen.getByText('Word of the day · 2.11')).toBeTruthy();
    expect(screen.queryByText('Word of the day · №312')).toBeNull();
    expect(screen.getByTestId('dashboard-hero-lemma')).toHaveTextContent('harbour');
    expect(screen.getByText('ha\u0301rbour · n., f.')).toBeTruthy();
    expect(screen.getByLabelText('Rarity 4 of 5')).toBeTruthy();
    expect(screen.getAllByTestId('dashboard-hero-rarity-full')).toHaveLength(4);
    expect(screen.getAllByTestId('dashboard-hero-rarity-empty')).toHaveLength(1);
    expect(screen.getByText('A safe place for ships.')).toBeTruthy();
    expect(screen.queryByText('Reveal the word')).toBeNull();
    expect(screen.queryByText('Catch the word!')).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'To the card →' }));

    expect(onToCard).toHaveBeenCalledTimes(1);
  });
  it('shouts as it reveals, and the Lemma flies in letter by letter', async () => {
    const { play, show } = await renderHero(unrevealed);

    await fireEvent.press(screen.getByRole('button', { name: 'Reveal the word' }));
    expect(play).toHaveBeenCalledWith('shout');
    expect(play).not.toHaveBeenCalledWith('tap');

    await show(revealed);
    const letters = screen.getAllByTestId('dashboard-hero-flying-letter', {
      includeHiddenElements: true,
    });
    expect(letters.map((letter) => String(letter.props['children']))).toEqual(
      Array.from('HARBOUR'),
    );
  });

  it('on a new day, revealed again, flies the new Lemma in though it opened revealed', async () => {
    const { show } = await renderHero(revealed);
    const tomorrow: WordOfTheDayHero = { ...unrevealed, date: { ...date, day: date.day + 1 } };

    await show(tomorrow);
    await show({ ...revealed, date: tomorrow.date });

    expect(
      screen.getAllByTestId('dashboard-hero-flying-letter', { includeHiddenElements: true }),
    ).not.toHaveLength(0);
  });

  it('opened already revealed, shows the Lemma still, with no letters flying', async () => {
    await renderHero(revealed);

    expect(
      screen.queryAllByTestId('dashboard-hero-flying-letter', { includeHiddenElements: true }),
    ).toHaveLength(0);
  });

  // Owner recording 12.11: the board's Рупор throws sparks from its megaphone (ADR 0109).
  it("throws the board's five sparks from the Mascot's megaphone, closed and open", async () => {
    const { show } = await renderHero(unrevealed, { sparks: true });

    expect(
      await screen.findAllByTestId('dashboard-hero-spark', { includeHiddenElements: true }),
    ).toHaveLength(5);
    await show(revealed);
    expect(
      screen.getAllByTestId('dashboard-hero-spark', { includeHiddenElements: true }),
    ).toHaveLength(5);
  });

  it('throws no sparks while the sparks are off', async () => {
    await renderHero(unrevealed);

    expect(
      screen.queryAllByTestId('dashboard-hero-spark', { includeHiddenElements: true }),
    ).toHaveLength(0);
  });

  it("throws no sparks without the Decor's Mascot figure, which has the megaphone", async () => {
    await renderHero(unrevealed, { sparks: true, decor: coreDecor });

    expect(
      screen.queryAllByTestId('dashboard-hero-spark', { includeHiddenElements: true }),
    ).toHaveLength(0);
  });

  it('throws no sparks under Reduce Motion', async () => {
    await renderHero(unrevealed, { sparks: true, reduceMotion: true });

    expect(
      screen.queryAllByTestId('dashboard-hero-spark', { includeHiddenElements: true }),
    ).toHaveLength(0);
  });

  // Owner test pass 12.11: the cream ended short of the card's right edge, under its padding.
  it("draws the open hero's cream as wide as its card, padding and all", async () => {
    await renderHero(revealed);
    await fireEvent(screen.getByTestId('dashboard-hero-card'), 'layout', {
      nativeEvent: { layout: { width: 338, height: 196 } },
    });

    const cream = screen.getByTestId('dashboard-hero-card-cream', { includeHiddenElements: true });
    expect(cream).toHaveProp('width', 338);
    expect(cream).toHaveProp('height', 196);
  });

  // SLOVO-60: «ВЕРБОЛІЗ» ran past the hero's right edge.
  it('draws a Lemma wider than the hero smaller, so it fits its line', async () => {
    await renderHero(revealed);
    const lemma = screen.getByTestId('dashboard-hero-lemma');
    const line = lemma.parent;
    if (line === null) throw new Error('The Lemma has no line around it');
    await fireEvent(line, 'layout', { nativeEvent: { layout: { width: 151 } } });
    // The word measured at full size: twice as wide as the line has room for, less a point.
    const measured = screen
      .getAllByText('harbour', { includeHiddenElements: true })
      .find((text) => text !== lemma);
    if (measured === undefined) throw new Error('The Lemma is not measured');
    await fireEvent(measured, 'textLayout', { nativeEvent: { lines: [{ width: 300 }] } });

    expect(lemma).toHaveStyle({ fontSize: typeRoles.dashboardLemma.size / 2 });
    expect(lemma).not.toHaveStyle({ opacity: 0 });
  });
  // Owner test pass 12.11: «високопревосходи́тельство · ім., ч. р.» wrapped beside the rarity bars and pushed the card onto the button.
  it('draws a word line wider than its room smaller, on one line beside the rarity bars', async () => {
    await renderHero(revealed);
    const wordLine = screen.getByText('ha\u0301rbour · n., f.');
    const room = wordLine.parent;
    if (room === null) throw new Error('The word line has no room around it');
    await fireEvent(room, 'layout', { nativeEvent: { layout: { width: 151 } } });
    // The line measured at full size: twice as wide as its room, less a point.
    const measured = screen
      .getAllByText('ha\u0301rbour · n., f.', { includeHiddenElements: true })
      .find((text) => text !== wordLine);
    if (measured === undefined) throw new Error('The word line is not measured');
    await fireEvent(measured, 'textLayout', { nativeEvent: { lines: [{ width: 300 }] } });

    expect(wordLine).toHaveProp('numberOfLines', 1);
    expect(wordLine).toHaveStyle({ fontSize: typeRoles.dashboardWordLine.size / 2 });
    expect(wordLine).not.toHaveStyle({ opacity: 0 });
    expect(screen.getAllByTestId('dashboard-hero-rarity-full')).toHaveLength(4);
  });
  it('keeps the word line drawn while its measure reports no lines', async () => {
    await renderHero(revealed);
    const wordLine = screen.getByText('ha\u0301rbour · n., f.');
    const room = wordLine.parent;
    if (room === null) throw new Error('The word line has no room around it');
    await fireEvent(room, 'layout', { nativeEvent: { layout: { width: 151 } } });
    const measured = screen
      .getAllByText('ha\u0301rbour · n., f.', { includeHiddenElements: true })
      .find((text) => text !== wordLine);
    if (measured === undefined) throw new Error('The word line is not measured');
    await fireEvent(measured, 'textLayout', { nativeEvent: { lines: [] } });

    expect(wordLine).not.toHaveStyle({ fontSize: -0 });
    expect(wordLine).toHaveStyle({ fontSize: typeRoles.dashboardWordLine.size });
  });
});
