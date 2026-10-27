import type { EditionStrings } from '@slovo/contracts';
import type { CurrentGame, GivenAnswer, Haptics, RoundAnswer } from '@slovo/core';
import { EditionProvider, GameRound, HapticsProvider } from '@slovo/ui';
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const strings = {
  game: {
    round: {
      progress: '{passed} / {total}',
      progressLabel: 'Rounds passed: {passed} of {total}',
      passed: 'Passed: {passed}',
      passedLabel: 'Rounds passed: {passed}',
      lives: 'Lives: {count} of {total}',
      highlight: 'Marked: {text}',
      gap: { label: 'Which word is missing?', voiceOver: 'gap' },
      correct: 'Right',
      chosen: 'Your choice',
      synonymRow: { label: 'Synonyms', prompt: 'What is a synonym of “{dominant}”?' },
      tip: { label: 'Tip' },
      typed: { label: 'Your answer', submit: 'Check' },
    },
    openLetter: 'Open a letter',
    letters: {
      label: '{letter}, {place} letter',
      empty: '{place} letter, empty',
      ordinals: ['first', 'second', 'third', 'fourth', 'fifth', 'sixth'],
    },
    exit: {
      label: 'Leave the Game',
      title: 'Leave?',
      message: 'The Game ends.',
      confirm: 'Leave',
      cancel: 'Play on',
    },
    sheet: { correct: 'Right!', wrong: 'Not this time', next: 'Next' },
  },
  wordCard: {
    stress: 'stress on {vowels}',
    stressOr: 'or',
    example: '{text}',
    exampleAuthor: '{author}',
  },
} as unknown as EditionStrings;

/** A screen with no insets, so the sheet needn't wait for the device's. */
const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

const haptics: Haptics = {
  selection: jest.fn(),
  impactLight: jest.fn(),
  impactMedium: jest.fn(),
  success: jest.fn(),
  warning: jest.fn(),
};

const OPTIONS = ['ardent', 'brittle', 'candid', 'dour'] as const;
/** The place of the right option. */
const CORRECT = 2;

const first: CurrentGame = {
  modeId: 'definition-to-word',
  round: {
    number: 1,
    entryKind: 'word',
    prompt: 'open and honest',
    highlight: undefined,
    form: 'pick',
    options: OPTIONS.map((text) => ({ text, stressedVowels: [] })),
    answer: undefined,
  },
  roundsPassed: 0,
  roundLimit: 15,
  lives: 5,
  livesAtStart: 5,
  played: [],
  status: 'playing',
};

/** The Game with its Round answered as given, as the Game in play answers it. */
function answered(game: CurrentGame, given: GivenAnswer): CurrentGame {
  if (given.form === 'vowel') return answeredVowel(game, given.position);
  if (given.form === 'pairs') return answeredPair(game, given.word, given.definition);
  if (given.form === 'typed') return answeredTyped(game, given.text);
  if (given.form === 'chips') return answeredChips(game, given.chips);
  return answeredPick(game, given);
}

/** The Game with its pick Round answered with the option at that place. */
function answeredPick(game: CurrentGame, given: GivenAnswer): CurrentGame {
  const chosen = given.form === 'pick' ? given.option : -1;
  return {
    ...game,
    round: {
      ...game.round,
      answer: {
        form: 'pick',
        chosen,
        correct: CORRECT,
        right: chosen === CORRECT,
        sheet: { answer: { text: OPTIONS[CORRECT], stressedVowels: [] }, example: undefined },
      },
    },
    lives: chosen === CORRECT || game.lives === undefined ? game.lives : game.lives - 1,
    status: 'answered',
  };
}

/** A Round of «Наголос» about a Word, «banana» with its second vowel stressed, its sheet the Word's Example. */
const wordVowelRound: CurrentGame = {
  ...first,
  modeId: 'stress',
  round: {
    number: 1,
    entryKind: 'word',
    prompt: 'banana',
    highlight: undefined,
    form: 'vowel',
    vowels: [1, 3, 5],
    answer: undefined,
  },
};

/** A Round of «Наголос» about a stress trap, «mango» stressed on its first vowel, its sheet the explanation. */
const trapVowelRound: CurrentGame = {
  ...first,
  modeId: 'stress',
  round: {
    number: 1,
    entryKind: 'correction',
    prompt: 'mango',
    highlight: undefined,
    form: 'vowel',
    vowels: [1, 4],
    answer: undefined,
  },
};

/** What the Core holds back of each vowel Round until it is answered: its stressed vowels and its sheet, by prompt. */
const VOWEL_ANSWERS: Record<string, Pick<VowelAnswer, 'stressed' | 'sheet'>> = {
  banana: {
    stressed: [3],
    sheet: {
      answer: { text: 'bana\u0301na', stressedVowels: ['a'] },
      example: { text: 'A banana a day.', author: 'A. Grocer' },
    },
  },
  mango: {
    stressed: [1],
    sheet: {
      answer: { text: 'ma\u0301ngo', stressedVowels: ['a'] },
      example: undefined,
      explanation: 'Say MAngo, not manGO.',
    },
  },
};

type VowelAnswer = Extract<RoundAnswer, { form: 'vowel' }>;

/** The Game with its vowel Round answered with the vowel at that position. */
function answeredVowel(game: CurrentGame, chosen: number): CurrentGame {
  const { round } = game;
  const held = VOWEL_ANSWERS[round.prompt];
  if (held === undefined) throw new Error(`No vowel Round is «${round.prompt}»`);
  const right = held.stressed.includes(chosen);
  return {
    ...game,
    round: { ...round, answer: { form: 'vowel', chosen, right, ...held } },
    lives: right || game.lives === undefined ? game.lives : game.lives - 1,
    status: 'answered',
  };
}

/** The first Round asking about a Synonym Row, the dominant its prompt, as the Core builds it. */
const rowRound: CurrentGame = {
  ...first,
  round: { ...first.round, entryKind: 'synonymRow', prompt: 'frank' },
};

/** The first Round asking a Tip its own question, a long one, as the Core builds it. */
const tipRound: CurrentGame = {
  ...first,
  round: {
    ...first.round,
    entryKind: 'tip',
    prompt:
      'Which of these words would you choose to describe a friend who always says what they think?',
  },
};

/** The sixth Round of «Вгадай слово», an Example with a gap where its Word stands, as the Core builds it. */
const gapRound: CurrentGame = {
  ...first,
  round: {
    ...first.round,
    number: 6,
    prompt: 'She gave a … account of the evening.',
    highlight: { start: 11, end: 12 },
  },
};

/** A pairs grid of «Пари»: its Words, and the place of each one's Definition among the Definitions. */
const PAIR_WORDS = ['ardent', 'candid'] as const;
const PAIR_DEFINITIONS = ['open and honest', 'full of passion'] as const;
const OWN_DEFINITION = [1, 0] as const;

const pairsRound: CurrentGame = {
  ...first,
  modeId: 'pairs',
  round: {
    number: 1,
    entryKind: 'word',
    prompt: '',
    highlight: undefined,
    form: 'pairs',
    words: PAIR_WORDS.map((text) => ({ shown: { text, stressedVowels: [] }, gone: false })),
    definitions: PAIR_DEFINITIONS.map((shown) => ({ shown, gone: false })),
    answer: undefined,
  },
};

/** The Game with its pairs Round answered with the Word, then the Definition at those places. */
function answeredPair(game: CurrentGame, word: number, definition: number): CurrentGame {
  const correct = OWN_DEFINITION[word] ?? -1;
  const right = definition === correct;
  return {
    ...game,
    round: {
      ...game.round,
      answer: {
        form: 'pairs',
        word,
        definition,
        correct,
        right,
        sheet: {
          answer: { text: PAIR_WORDS[word] ?? '', stressedVowels: [] },
          example: { text: 'An ardent reader.', author: undefined },
        },
      },
    },
    lives: right || game.lives === undefined ? game.lives : game.lives - 1,
    status: 'answered',
  };
}

/** A Round of «За буквами»: «well-read» to type, its hyphen in place from the start. */
const TYPED = 'well-read';
const typedRound: CurrentGame = {
  ...first,
  modeId: 'by-letters',
  round: {
    number: 1,
    entryKind: 'word',
    prompt: 'having read much',
    highlight: undefined,
    form: 'typed',
    blanks: Array.from(TYPED, (character) => (character === '-' ? character : undefined)),
    canOpenLetter: true,
    answer: undefined,
  },
};

/** The Game with its typed Round answered with the text, right only as typed exactly. */
function answeredTyped(game: CurrentGame, typed: string): CurrentGame {
  const right = typed === TYPED;
  return {
    ...game,
    round: {
      ...game.round,
      answer: {
        form: 'typed',
        typed,
        expected: TYPED,
        right,
        sheet: {
          answer: { text: TYPED, stressedVowels: [] },
          example: { text: 'A well-read friend.', author: undefined },
        },
      },
    },
    lives: right || game.lives === undefined ? game.lives : game.lives - 1,
    status: 'answered',
  };
}

/** The Game with the first blank of its typed Round opened, as the Game in play opens it. */
function withLetterOpened(game: CurrentGame): CurrentGame {
  const { round } = game;
  if (round.form !== 'typed' || round.blanks === undefined) return game;
  const first = round.blanks.indexOf(undefined);
  const blanks = round.blanks.map((blank, place) => (place === first ? TYPED[place] : blank));
  const left = blanks.filter((blank) => blank === undefined).length;
  return { ...game, round: { ...round, blanks, canOpenLetter: left > 1 } };
}

/** A Round of «Анаграми»: «o'brok» from shuffled letters, its apostrophe in place. */
const CHIPS = ['k', 'o', 'r', 'b', 'o'] as const;
const ANAGRAM = ['o', 'b', 'r', 'o', 'k'] as const;
const chipsRound: CurrentGame = {
  ...first,
  modeId: 'anagram',
  round: {
    number: 1,
    entryKind: 'word',
    prompt: 'a tribute paid in kind',
    highlight: undefined,
    form: 'chips',
    chips: CHIPS,
    fixed: [{ at: 1, text: "'" }],
    answer: undefined,
  },
};

/** The Game with its chips Round answered with the chips at those places, equal chips interchangeable. */
function answeredChips(game: CurrentGame, chosen: readonly number[]): CurrentGame {
  const right = chosen.every((place, index) => CHIPS[place] === ANAGRAM[index]);
  return {
    ...game,
    round: {
      ...game.round,
      answer: {
        form: 'chips',
        chosen,
        expected: ANAGRAM,
        right,
        sheet: {
          answer: { text: "o'brok", stressedVowels: [] },
          example: { text: 'An o’brok of grain.', author: undefined },
        },
      },
    },
    lives: right || game.lives === undefined ? game.lives : game.lives - 1,
    status: 'answered',
  };
}

/** The mode's label over a Round, by its answer form. */
const LABELS: Partial<Record<CurrentGame['round']['form'], string>> = {
  vowel: 'Where is the stress?',
  pairs: 'Find the pairs',
};

function Game({
  start,
  onAnswer,
  onLeave,
  onOpenLetter,
}: {
  start: CurrentGame;
  onAnswer: (given: GivenAnswer) => void;
  onLeave: () => void;
  onOpenLetter: () => void;
}) {
  const [game, setGame] = useState(start);
  return (
    <GameRound
      game={game}
      label={LABELS[game.round.form] ?? 'Definition'}
      onAnswer={(given) => {
        onAnswer(given);
        setGame((shown) => answered(shown, given));
      }}
      onNext={jest.fn()}
      onLeave={onLeave}
      onOpenLetter={() => {
        onOpenLetter();
        setGame(withLetterOpened);
      }}
    />
  );
}

async function renderRound(
  onAnswer: (given: GivenAnswer) => void = jest.fn(),
  onLeave: () => void = jest.fn(),
  start: CurrentGame = first,
  onOpenLetter: () => void = jest.fn(),
) {
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <EditionProvider edition={{ locale: 'en' }} strings={strings}>
        <HapticsProvider haptics={haptics}>
          <Game start={start} onAnswer={onAnswer} onLeave={onLeave} onOpenLetter={onOpenLetter} />
        </HapticsProvider>
      </EditionProvider>
    </SafeAreaProvider>,
  );
}

describe('GameRound', () => {
  it('counts the Rounds passed out of the Round limit and the Lives out of those the Game started with', async () => {
    await renderRound(jest.fn(), jest.fn(), { ...first, roundsPassed: 7, lives: 4 });

    expect(screen.getByTestId('game-progress').props['accessibilityLabel']).toBe(
      'Rounds passed: 7 of 15',
    );
    expect(screen.getByText('7 / 15')).toBeTruthy();
    expect(screen.getByTestId('game-lives').props['accessibilityLabel']).toBe('Lives: 4 of 5');
  });

  it('counts the Rounds passed with no limit in a mode without one, and its own Lives', async () => {
    await renderRound(jest.fn(), jest.fn(), {
      ...first,
      modeId: 'survival',
      roundsPassed: 23,
      roundLimit: undefined,
      lives: 2,
      livesAtStart: 3,
    });

    expect(screen.getByTestId('game-progress').props['accessibilityLabel']).toBe(
      'Rounds passed: 23',
    );
    expect(screen.getByText('Passed: 23')).toBeTruthy();
    expect(screen.queryByTestId('game-progress-bar')).toBeNull();
    expect(screen.getByTestId('game-lives').props['accessibilityLabel']).toBe('Lives: 2 of 3');
  });

  it('shows a right answer as right', async () => {
    await renderRound();

    await fireEvent.press(screen.getByRole('button', { name: 'candid' }));

    expect(screen.getByRole('button', { name: 'candid, Right' })).toBeTruthy();
    expect(screen.queryByText('Your choice')).toBeNull();
    expect(screen.getByRole('header', { name: 'Right!' })).toBeTruthy();
  });

  it('shows a wrong choice beside the right answer', async () => {
    await renderRound();

    await fireEvent.press(screen.getByRole('button', { name: 'brittle' }));

    expect(screen.getByRole('button', { name: 'brittle, Your choice' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'candid, Right' })).toBeTruthy();
    expect(screen.getByRole('header', { name: 'Not this time' })).toBeTruthy();
  });

  it('takes one answer a Round: a second tap does not count', async () => {
    const onAnswer = jest.fn();
    await renderRound(onAnswer);

    await fireEvent.press(screen.getByRole('button', { name: 'brittle' }));
    await fireEvent.press(screen.getByRole('button', { name: 'dour' }));
    await fireEvent.press(screen.getByRole('button', { name: 'brittle, Your choice' }));

    expect(onAnswer).toHaveBeenCalledTimes(1);
    expect(onAnswer).toHaveBeenCalledWith({ form: 'pick', option: 1 });
    expect(screen.getByRole('button', { name: 'brittle, Your choice' })).toBeTruthy();
  });

  it("asks a Synonym Row's question under its own label, and takes an answer", async () => {
    const onAnswer = jest.fn();
    await renderRound(onAnswer, jest.fn(), rowRound);

    expect(screen.getByTestId('game-prompt')).toHaveAccessibleName(
      'Synonyms. What is a synonym of “frank”?',
    );
    expect(screen.getByText('What is a synonym of “frank”?')).toBeOnTheScreen();
    expect(screen.queryByText('Definition')).not.toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'candid' }));

    expect(onAnswer).toHaveBeenCalledWith({ form: 'pick', option: CORRECT });
    expect(screen.getByRole('button', { name: 'candid, Right' })).toBeTruthy();
    expect(screen.getByRole('header', { name: 'Right!' })).toBeTruthy();
  });

  it('asks a Tip its own question, whole however long, under its own label, and takes an answer', async () => {
    const onAnswer = jest.fn();
    await renderRound(onAnswer, jest.fn(), tipRound);

    expect(screen.getByTestId('game-prompt')).toHaveAccessibleName(`Tip. ${tipRound.round.prompt}`);
    expect(screen.getByText(tipRound.round.prompt)).toBeOnTheScreen();
    expect(screen.queryByText('Definition')).not.toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'dour' }));

    expect(onAnswer).toHaveBeenCalledWith({ form: 'pick', option: 3 });
    expect(screen.getByRole('button', { name: 'dour, Your choice' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'candid, Right' })).toBeTruthy();
    expect(screen.getByRole('header', { name: 'Not this time' })).toBeTruthy();
  });

  it('asks a Word by its Example with a gap under its own label, VoiceOver reading the gap, and takes an answer', async () => {
    const onAnswer = jest.fn();
    await renderRound(onAnswer, jest.fn(), gapRound);

    expect(screen.getByTestId('game-prompt')).toHaveAccessibleName(
      'Which word is missing? She gave a gap account of the evening.',
    );
    expect(screen.getByText('She gave a … account of the evening.')).toBeOnTheScreen();
    expect(screen.queryByText('Definition')).not.toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'candid' }));

    expect(onAnswer).toHaveBeenCalledWith({ form: 'pick', option: CORRECT });
    expect(screen.getByRole('button', { name: 'candid, Right' })).toBeTruthy();
    expect(screen.getByRole('header', { name: 'Right!' })).toBeTruthy();
  });

  describe('a vowel Round', () => {
    it('asks under the mode’s label with the Word’s vowels as buttons VoiceOver reads by place', async () => {
      await renderRound(jest.fn(), jest.fn(), wordVowelRound);

      expect(screen.getByText('Where is the stress?')).toBeOnTheScreen();
      expect(screen.getByTestId('game-vowels')).toHaveTextContent('banana', { exact: true });
      expect(
        screen.getAllByRole('button').map((button): unknown => button.props['accessibilityLabel']),
      ).toEqual(['Leave the Game', 'a, second letter', 'a, fourth letter', 'a, sixth letter']);
    });

    it('answers a Word with the vowel tapped and shows the Word with its Stress and Example', async () => {
      const onAnswer = jest.fn();
      await renderRound(onAnswer, jest.fn(), wordVowelRound);

      await fireEvent.press(screen.getByRole('button', { name: 'a, fourth letter' }));

      expect(onAnswer).toHaveBeenCalledWith({ form: 'vowel', position: 3 });
      expect(screen.getByRole('button', { name: 'a, fourth letter, Right' })).toBeTruthy();
      expect(screen.getByRole('header', { name: 'Right!' })).toBeTruthy();
      expect(screen.getByText('bana\u0301na')).toBeOnTheScreen();
      expect(screen.getByText('A banana a day.')).toBeOnTheScreen();
    });

    it('shows a stress trap’s wrong tap beside its Stress, and the explanation in the sheet', async () => {
      const onAnswer = jest.fn();
      await renderRound(onAnswer, jest.fn(), trapVowelRound);

      await fireEvent.press(screen.getByRole('button', { name: 'o, fifth letter' }));
      await fireEvent.press(screen.getByRole('button', { name: 'a, second letter, Right' }));

      expect(onAnswer).toHaveBeenCalledTimes(1);
      expect(onAnswer).toHaveBeenCalledWith({ form: 'vowel', position: 4 });
      expect(screen.getByRole('button', { name: 'o, fifth letter, Your choice' })).toBeTruthy();
      expect(screen.getByRole('header', { name: 'Not this time' })).toBeTruthy();
      expect(screen.getByText('ma\u0301ngo')).toBeOnTheScreen();
      expect(screen.getByTestId('game-sheet-explanation')).toHaveTextContent(
        'Say MAngo, not manGO.',
      );
    });
  });

  describe('a pairs Round', () => {
    it('asks under the mode’s label with the grid’s Words and Definitions as buttons', async () => {
      await renderRound(jest.fn(), jest.fn(), pairsRound);

      expect(screen.getByRole('header', { name: 'Find the pairs' })).toBeTruthy();
      expect(
        screen.getAllByRole('button').map((button): unknown => button.props['accessibilityLabel']),
      ).toEqual(['Leave the Game', 'ardent', 'candid', 'open and honest', 'full of passion']);
    });

    it('answers with the Word, then the Definition tapped, and shows the Word with its Example', async () => {
      const onAnswer = jest.fn();
      await renderRound(onAnswer, jest.fn(), pairsRound);

      await fireEvent.press(screen.getByRole('button', { name: 'candid' }));
      await fireEvent.press(screen.getByRole('button', { name: 'open and honest' }));

      expect(onAnswer).toHaveBeenCalledWith({ form: 'pairs', word: 1, definition: 0 });
      expect(screen.getByRole('header', { name: 'Right!' })).toBeTruthy();
      expect(screen.getByText('An ardent reader.')).toBeOnTheScreen();
      expect(screen.getByLabelText('Lives: 5 of 5')).toBeOnTheScreen();
    });

    it('takes a Life for a wrong pair', async () => {
      await renderRound(jest.fn(), jest.fn(), pairsRound);

      await fireEvent.press(screen.getByRole('button', { name: 'ardent' }));
      await fireEvent.press(screen.getByRole('button', { name: 'open and honest' }));

      expect(screen.getByRole('header', { name: 'Not this time' })).toBeTruthy();
      expect(screen.getByLabelText('Lives: 4 of 5')).toBeOnTheScreen();
    });
  });

  describe('a chips Round', () => {
    it('asks a Definition under the mode’s label, with the letters as chips and the apostrophe in place', async () => {
      await renderRound(jest.fn(), jest.fn(), chipsRound);

      expect(screen.getByTestId('game-prompt').props['accessibilityLabel']).toBe(
        'Definition. a tribute paid in kind',
      );
      expect(screen.queryAllByTestId(/^chips-\d+$/)).toHaveLength(5);
      expect(screen.getByRole('button', { name: 'k' })).toBeEnabled();
    });

    it('answers with the chips in the order tapped and shows the Word with its Example', async () => {
      const onAnswer = jest.fn();
      await renderRound(onAnswer, jest.fn(), chipsRound);

      for (const place of [1, 3, 2, 4, 0]) {
        await fireEvent.press(screen.getByTestId(`chips-${String(place)}`));
      }

      expect(onAnswer).toHaveBeenCalledWith({ form: 'chips', chips: [1, 3, 2, 4, 0] });
      expect(screen.getByTestId('chips-line')).toHaveTextContent("o'brok");
      expect(screen.getByRole('header', { name: 'Right!' })).toBeTruthy();
      expect(screen.getByText('An o’brok of grain.')).toBeOnTheScreen();
    });

    it('takes a Life for a Word assembled wrong and shows the right one in the sheet', async () => {
      await renderRound(jest.fn(), jest.fn(), chipsRound);

      for (const place of [0, 1, 2, 3, 4]) {
        await fireEvent.press(screen.getByTestId(`chips-${String(place)}`));
      }

      expect(screen.getByRole('header', { name: 'Not this time' })).toBeTruthy();
      expect(screen.getByTestId('game-sheet')).toHaveTextContent("o'brok", { exact: false });
      expect(screen.getByLabelText('Lives: 4 of 5')).toBeOnTheScreen();
    });
  });

  describe('a typed Round with blanks', () => {
    it('asks under the mode’s label with a blank per letter VoiceOver reads by place, the hyphen in place', async () => {
      await renderRound(jest.fn(), jest.fn(), typedRound);

      expect(screen.getByTestId('game-prompt').props['accessibilityLabel']).toBe(
        'Definition. having read much',
      );
      // Eight letters, the fifth the «r» after the hyphen, which stands in its place.
      expect(screen.getAllByLabelText(/ letter, empty$/)).toHaveLength(8);
      expect(screen.getByLabelText('fifth letter, empty')).toBeOnTheScreen();
      expect(screen.getByTestId('game-typed-blanks')).toHaveTextContent('-', { exact: false });
      expect(screen.getByLabelText('Your answer')).toBeOnTheScreen();
      expect(screen.getByRole('button', { name: 'Open a letter' })).toBeEnabled();
      expect(screen.getByRole('button', { name: 'Check' })).toBeDisabled();
    });

    it('opens the first blank’s letter at «Open a letter», at no cost', async () => {
      const onOpenLetter = jest.fn();
      await renderRound(jest.fn(), jest.fn(), typedRound, onOpenLetter);

      await fireEvent.press(screen.getByRole('button', { name: 'Open a letter' }));
      await fireEvent.press(screen.getByRole('button', { name: 'Open a letter' }));

      expect(onOpenLetter).toHaveBeenCalledTimes(2);
      expect(screen.getByLabelText('w, first letter')).toBeOnTheScreen();
      expect(screen.getByLabelText('e, second letter')).toBeOnTheScreen();
      expect(screen.getByLabelText('third letter, empty')).toBeOnTheScreen();
      expect(screen.getByLabelText('Lives: 5 of 5')).toBeOnTheScreen();
    });

    it('answers with the text typed and shows the Word with its Example', async () => {
      const onAnswer = jest.fn();
      await renderRound(onAnswer, jest.fn(), typedRound);

      await fireEvent.changeText(screen.getByLabelText('Your answer'), TYPED);
      await fireEvent.press(screen.getByRole('button', { name: 'Check' }));

      expect(onAnswer).toHaveBeenCalledWith({ form: 'typed', text: TYPED });
      expect(screen.getByRole('header', { name: 'Right!' })).toBeTruthy();
      expect(screen.getByText('A well-read friend.')).toBeOnTheScreen();
    });

    it('takes a Life for a wrong Word and shows the right one in the sheet', async () => {
      await renderRound(jest.fn(), jest.fn(), typedRound);

      await fireEvent.changeText(screen.getByLabelText('Your answer'), 'well-bred');
      await fireEvent(screen.getByLabelText('Your answer'), 'submitEditing');

      expect(screen.getByRole('header', { name: 'Not this time' })).toBeTruthy();
      expect(screen.getByTestId('game-sheet')).toHaveTextContent(TYPED, { exact: false });
      expect(screen.getByLabelText('Lives: 4 of 5')).toBeOnTheScreen();
    });
  });

  describe('leaving', () => {
    it('asks before it leaves, and shows no dialog until the ✕ is pressed', async () => {
      const onLeave = jest.fn();
      await renderRound(jest.fn(), onLeave);

      expect(screen.queryByText('Leave?')).not.toBeOnTheScreen();

      await fireEvent.press(screen.getByRole('button', { name: 'Leave the Game' }));

      expect(screen.getByText('Leave?')).toBeOnTheScreen();
      expect(screen.getByText('The Game ends.')).toBeOnTheScreen();
      expect(onLeave).not.toHaveBeenCalled();
    });

    it('leaves when the reader confirms, and closes the dialog', async () => {
      const onLeave = jest.fn();
      await renderRound(jest.fn(), onLeave);
      await fireEvent.press(screen.getByRole('button', { name: 'Leave the Game' }));

      await fireEvent.press(screen.getByTestId('game-exit-dialog-destructive'));

      expect(onLeave).toHaveBeenCalledTimes(1);
      expect(screen.queryByText('Leave?')).not.toBeOnTheScreen();
    });

    it('plays on when the reader cancels, and closes the dialog', async () => {
      const onLeave = jest.fn();
      await renderRound(jest.fn(), onLeave);
      await fireEvent.press(screen.getByRole('button', { name: 'Leave the Game' }));

      await fireEvent.press(screen.getByTestId('game-exit-dialog-cancel'));

      expect(onLeave).not.toHaveBeenCalled();
      expect(screen.queryByText('Leave?')).not.toBeOnTheScreen();
      expect(screen.getByRole('button', { name: 'candid' })).toBeOnTheScreen();
    });
  });
});
