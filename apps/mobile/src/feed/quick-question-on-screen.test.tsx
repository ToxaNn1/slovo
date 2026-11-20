import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Word } from '@slovo/contracts';
import {
  openComposition,
  type Composition,
  type TrackedUserState,
  type Edition,
  type Random,
} from '@slovo/core';
import {
  createMemoryContentPort,
  seedUserState,
  type UserStateFacts,
  loadEdition,
} from '@slovo/core/testing';
import { renderApp } from '../shell/test-app';
import { act, fireEvent, screen, within } from 'expo-router/testing-library';

import HomeScreen from '../app/feed';
import { opened, switchedTo, testShell } from '../shell/test-support';
import EntryLayout from '../app/entry/_layout';
import EntryFromLinkScreen from '../app/entry/[entryId]';
import { fill } from '@slovo/contracts';
import { activeEditionFiles, editionStrings } from '../edition/edition';
import { screenSettled } from '../use-open-screen';

const { config } = activeEditionFiles;

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { extra: { edition: { wordOfTheDayFontFamily: 'Unbounded' } } } },
}));

/** The UA Edition as its config file gives it, every Feature Switch as it ships. */
const shippedEdition: Edition = loadEdition(config);

/** The user state the settings and the composition keep, opened afresh for each test. */
let userState: TrackedUserState;

/** The composition the screens read, opened afresh for each test. */
let composition: Composition;

const clock = { now: () => new Date('2026-10-28T09:00:00Z'), timeZone: () => 'Europe/Kyiv' };

// The app in the foreground, where the Feed gets its next card ready.
jest.mock('../foreground/in-foreground', () => ({ useInForeground: () => true }));

/** A Word of the Edition's first Category, with the Stress on its second letter. */
function word(id: string, lemma: string, primaryDefinition = `Значення слова ${lemma}.`): Word {
  return {
    kind: 'word',
    id,
    lemma,
    stress: [1],
    partOfSpeech: 'adjective',
    primaryDefinition,
    extraDefinitions: [],
    examples: [],
    synonyms: [],
    antonyms: [],
    registers: [],
    categoryId: 'emotions-character',
    rarity: 3,
    sources: [{ title: 'Словник' }],
    correctionIds: [],
    retired: false,
  };
}

/**
 * Opens the composition over 14 Words for a reader who finished the
 * onboarding with the facts given, on 2026-10-28 in Kyiv.
 */
async function open(
  facts: UserStateFacts,
  {
    definition,
    random = { next: () => 0 },
  }: { definition?: (index: number) => string; random?: Random } = {},
) {
  // The gestures hint was shown on an earlier launch: its finger demo loops for as long as
  // the sheet is open, which settling every timer would never finish. It has its own test.
  userState = await seedUserState({ ...facts, gesturesHintShown: true }, { clock });
  composition = await openComposition({
    content: createMemoryContentPort({
      categories: [
        { id: 'emotions-character', displayName: 'Емоції', description: 'Емоції.', tone: 'loud' },
      ],
      words: Array.from({ length: 14 }, (_, index) =>
        word(`w_${String(index)}`, `слово${String(index)}`, definition?.(index)),
      ),
    }),
    edition: shippedEdition,
    userState: userState,
    clock,
    // The first Word in each draw unless given, so each opening shows the same Word of the Day.
    random,
  });
}

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
  screenSettled();
});

async function settle(action: () => unknown = () => undefined) {
  await act(async () => {
    await action();
    await jest.runAllTimersAsync();
  });
}

/** The Shell the app draws under: the settings and the composition over the test's user state. */
const shell = () =>
  testShell({
    userState: opened(userState),
    remoteSwitches: switchedTo(shippedEdition),
    composition: opened(composition),
  });

/** The app on the Feed, with the Entry screen a link opens. */
async function openApp() {
  await renderApp(
    { index: HomeScreen, 'entry/_layout': EntryLayout, 'entry/[entryId]': EntryFromLinkScreen },
    { shell: shell() },
  );
  await settle();
  // The pager lays its pages out once it knows its height.
  await fireEvent(screen.getByTestId('feed'), 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 844 } },
  });
  await settle();
}

const hidden = { includeHiddenElements: true };

// Spec #1358, ticket #1374: the Quick Question in its own Feed slot.
describe('the Quick Question on the Feed', () => {
  it('asks its Round and keeps the option the reader picked', async () => {
    await open({ onboardingFinished: '2026-09-01T09:00:00Z', mixQuickQuestion: 6 });
    while (!composition.feed.cards.some((card) => card.kind === 'quick-question')) {
      if ((await composition.feed.next()) === undefined) throw new Error('No Quick Question');
    }
    const position = composition.feed.cards.findIndex((card) => card.kind === 'quick-question');
    const asked = composition.feed.cards[position];
    if (asked?.kind !== 'quick-question') throw new Error('No Quick Question');
    // The reader is on the Quick Question when the Feed is drawn.
    await composition.feed.show(position);
    await openApp();

    const card = screen.getByTestId('quick-question', hidden);
    // The tag is the card's heading VoiceOver reads: the Round's one label it shows, then the title.
    expect(within(card).getByTestId('quick-question-tag', hidden)).toHaveProp(
      'accessibilityLabel',
      expect.stringMatching(new RegExp(`^.*[^.?!…][.?!…] ${editionStrings.feed.quickQuestion}$`)),
    );
    expect(within(card).getAllByText(asked.round.prompt, hidden).length).toBeGreaterThan(0);
    await settle(() =>
      fireEvent.press(
        within(card).getByTestId(`game-option-${String(asked.round.correct)}`, hidden),
      ),
    );

    expect(composition.feed.cards[position]).toMatchObject({ answered: asked.round.correct });
    expect(
      within(screen.getByTestId('quick-question', hidden)).getByTestId('game-option-0', hidden),
    ).toBeDisabled();
  });

  // Owner test pass 08.11: the Feed explains the answer as the Game does, right or wrong.
  it.each([
    ['right', true],
    ['wrong', false],
  ])('explains a %s answer in the answer card until «Далі →»', async (_, right) => {
    await open({ onboardingFinished: '2026-09-01T09:00:00Z', mixQuickQuestion: 6 });
    while (!composition.feed.cards.some((card) => card.kind === 'quick-question')) {
      if ((await composition.feed.next()) === undefined) throw new Error('No Quick Question');
    }
    const position = composition.feed.cards.findIndex((card) => card.kind === 'quick-question');
    const asked = composition.feed.cards[position];
    if (asked?.kind !== 'quick-question') throw new Error('No Quick Question');
    await composition.feed.show(position);
    await openApp();
    const option = right ? asked.round.correct : (asked.round.correct + 1) % 4;
    const card = screen.getByTestId('quick-question', hidden);
    expect(screen.queryByTestId('game-answer-card', hidden)).toBeNull();

    await settle(() =>
      fireEvent.press(within(card).getByTestId(`game-option-${String(option)}`, hidden)),
    );

    const answerCard = editionStrings.game.round.answerCard;
    expect(screen.getByTestId('game-answer-card-title', hidden)).toHaveTextContent(
      right ? answerCard.right : answerCard.wrong,
    );
    const definition = 'primaryDefinition' in asked.entry ? asked.entry.primaryDefinition : '';
    expect(screen.getByTestId('game-answer-card-line', hidden)).toHaveTextContent(
      asked.round.sheet.explanation ?? definition,
    );
    await settle(() => fireEvent.press(screen.getByTestId('game-next', hidden)));
    await act(() => jest.advanceTimersByTimeAsync(1000));
    expect(screen.queryByTestId('game-answer-card', hidden)).toBeNull();
  });

  // Spec #1831, ticket #1834: real Definitions run to 236 characters, and four of them fit the card.
  it('asks the Word Meaning question with four long Definitions shown whole', async () => {
    const longest = 236;
    // A Definition of exactly 236 characters, its own for each Word.
    const definition = (index: number) =>
      `${String(index)} `
        .concat('Той, хто довго й уважно добирає слова. '.repeat(7))
        .slice(0, longest);
    // A draw that walks through the Quick Question's sources rather than always taking the first.
    let draws = 0;
    const random = { next: () => ((draws += 1) * 0.37) % 1 };
    await open(
      { onboardingFinished: '2026-09-01T09:00:00Z', mixQuickQuestion: 6 },
      { definition, random },
    );
    const isWordMeaning = () =>
      composition.feed.cards.findIndex(
        (card) => card.kind === 'quick-question' && card.source.kind === 'word-meaning',
      );
    for (let card = 0; isWordMeaning() === -1; card += 1) {
      if (card > 40 || (await composition.feed.next()) === undefined)
        throw new Error('No Word Meaning');
    }
    const position = isWordMeaning();
    const asked = composition.feed.cards[position];
    if (asked?.kind !== 'quick-question') throw new Error('No Word Meaning');
    await composition.feed.show(position);
    await openApp();

    const card = screen.getByTestId('quick-question', hidden);
    // The kicker is the Feed's «Швидке питання», drawn in capitals, over «„{word}“ — це…».
    expect(within(card).getByTestId('quick-question-tag', hidden)).toHaveTextContent(
      editionStrings.feed.quickQuestion,
    );
    expect(
      within(card).getAllByText(
        fill(editionStrings.game.round.prompts.meaning, { word: asked.round.prompt }),
        hidden,
      ).length,
    ).toBeGreaterThan(0);
    expect(asked.round.options).toHaveLength(4);
    for (const [place, option] of asked.round.options.entries()) {
      expect(Array.from(option.text)).toHaveLength(longest);
      const button = within(card).getByTestId(`game-option-${String(place)}`, hidden);
      // Whole: every character on the button, on as many lines as it takes, never cut or shrunk.
      const texts = within(button).getAllByText(option.text, hidden);
      expect(texts.length).toBeGreaterThan(0);
      for (const text of texts) {
        expect(text).not.toHaveProp('numberOfLines', expect.anything());
        expect(text).not.toHaveProp('adjustsFontSizeToFit', true);
      }
    }
    // The card fills its page and the long options scroll inside it: nothing scrolls around the card (owner, 16.11).
    expect(within(card).getByTestId('quick-question-scroll', hidden).type).toBe('RCTScrollView');
    expect(scrollViewsAround(card)).toBe(0);
  });
});

/** How many scroll views hold `element` up to the Feed's pager, which turns the pages. */
function scrollViewsAround(element: ReturnType<typeof screen.getByTestId>): number {
  let count = 0;
  for (let parent = element.parent; parent !== null; parent = parent.parent) {
    const { testID } = parent.props;
    if (typeof testID === 'string' && testID.startsWith('feed-card-')) return count;
    if (parent.type === 'RCTScrollView') count += 1;
  }
  throw new Error('The card is not on a Feed page');
}
