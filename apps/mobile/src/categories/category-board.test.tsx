import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Word } from '@slovo/contracts';
import { openComposition, type Composition, type Edition } from '@slovo/core';
import { createMemoryContentPort, seedUserState, loadEdition } from '@slovo/core/testing';
import { renderApp } from '../shell/test-app';
import { act, fireEvent, screen, within } from 'expo-router/testing-library';
import { State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';

import CategoryScreen from '../app/category/[categoryId]';
import EntryFromSearchScreen from '../app/search/[entryId]';
import CategoryFeedScreen from '../app/category-feed/[categoryId]';
import { activeEditionFiles, editionStrings } from '../edition/edition';
import { opened, switchedTo, testShell } from '../shell/test-support';
import { screenSettled } from '../use-open-screen';

const clock = { now: () => new Date('2026-10-28T09:00:00Z'), timeZone: () => 'Europe/Kyiv' };

function word(id: string, lemma: string, categoryId: string, retired = false): Word {
  return {
    kind: 'word',
    id,
    lemma,
    stress: [1],
    partOfSpeech: 'adjective',
    primaryDefinition: `Значення слова ${lemma}.`,
    extraDefinitions: [],
    examples: [],
    synonyms: [],
    antonyms: [],
    registers: [],
    categoryId,
    rarity: 3,
    sources: [{ title: 'Словник' }],
    correctionIds: [],
    retired,
  };
}

let editionInEffect: Edition;
let composition: Composition;
let shellOf: () => ReturnType<typeof testShell>;

/** Opens the composition over Categories of Words: «Емоції» with three live Words and a Retired one, «Порожня» with none, «Природа» with five. */
async function open({
  categoryFeed = true,
}: {
  categoryFeed?: boolean;
} = {}) {
  const shipped = loadEdition(activeEditionFiles.config);
  editionInEffect = {
    ...shipped,
    isFeatureEnabled: (feature) =>
      feature === 'categoryFeed'
        ? categoryFeed
        : feature === 'categoryScreens' || shipped.isFeatureEnabled(feature),
  };
  const userState = await seedUserState(
    { onboardingFinished: '2026-09-01T09:00:00.000Z' },
    { clock },
  );
  composition = await openComposition({
    content: createMemoryContentPort({
      categories: [
        {
          id: 'emotions-character',
          displayName: 'Емоції',
          description: 'Слова про почуття.',
          tone: 'loud',
        },
        { id: 'empty', displayName: 'Порожня', description: 'Тут ще нічого.', tone: 'loud' },
        { id: 'nature', displayName: 'Природа', description: 'Ліс і поле.', tone: 'loud' },
        { id: 'war', displayName: 'Війна', description: 'Слова, що болять.', tone: 'quiet' },
      ],
      words: [
        word('w_sumyrnyi', 'сумирний', 'emotions-character'),
        word('w_staryi', 'старий', 'emotions-character', true),
        word('w_lahidnyi', 'лагідний', 'emotions-character'),
        word('w_tykhyi', 'тихий', 'emotions-character'),
        word('w_lis', 'гайовий', 'nature'),
        word('w_bir', 'бір', 'nature'),
        word('w_luh', 'луг', 'nature'),
        word('w_dibrova', 'діброва', 'nature'),
        word('w_yar', 'яр', 'nature'),
        word('w_vtrata', 'втрата', 'war'),
      ],
    }),
    edition: editionInEffect,
    userState,
    clock,
    random: { next: () => 0 },
  });
  shellOf = () =>
    testShell({
      userState: opened(userState),
      remoteSwitches: switchedTo(editionInEffect),
      composition: opened(composition),
    });
}

beforeEach(() => {
  jest.useFakeTimers({ now: clock.now() });
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

/** The app on a Category's screen, with the Search route its cards open. */
async function renderCategory(categoryId: string) {
  await renderApp(
    {
      index: () => null,
      'category/[categoryId]': CategoryScreen,
      'search/[entryId]': EntryFromSearchScreen,
      'category-feed/[categoryId]': CategoryFeedScreen,
    },
    { shell: shellOf(), initialUrl: `/category/${categoryId}` },
  );
  await settle();
}

const hiddenIds = () => composition.mix.state.hiddenCategories.map(({ id }) => id);

describe('the Category screen', () => {
  it('heads its Words with the kicker, name, description and «ЗНАЮ x З n» from the Known marks', async () => {
    await open();
    await composition.knowledge.set('w_lahidnyi', 'known');
    await renderCategory('emotions-character');

    const hero = screen.getByTestId('category-hero');
    expect(within(hero).getByText('КАТЕГОРІЯ · 3 слова')).toBeTruthy();
    expect(within(hero).getByText('Емоції')).toBeTruthy();
    expect(within(hero).getByText('Слова про почуття.')).toBeTruthy();
    expect(within(hero).getByText('ЗНАЮ 1 З 3')).toBeTruthy();
  });

  it('names its way back «Назад», since it opens from the rail, its grid and Search alike', async () => {
    await open();
    await renderCategory('emotions-character');

    expect(screen.getByTestId('category-back')).toHaveProp('accessibilityLabel', 'Назад');
  });

  it('«ДОДАТИ» puts the Category in the Mix as «У МІКСІ», and a second tap takes it out, each with its toast', async () => {
    await open();
    await composition.mix.setCategory('emotions-character', false);
    await renderCategory('emotions-character');

    await settle(() => fireEvent.press(screen.getByRole('togglebutton', { name: 'ДОДАТИ' })));
    expect(hiddenIds()).toEqual([]);
    expect(screen.getByRole('togglebutton', { name: 'У ТЕМАХ' })).toBeTruthy();
    expect(screen.getByText('«Емоції» тепер у твоїх темах.')).toBeTruthy();

    await settle(() => fireEvent.press(screen.getByRole('togglebutton', { name: 'У ТЕМАХ' })));
    expect(hiddenIds()).toEqual(['emotions-character']);
    expect(screen.getByRole('togglebutton', { name: 'ДОДАТИ' })).toBeTruthy();
    expect(screen.getByText('«Емоції» прибрано з твоїх тем.')).toBeTruthy();
  });

  it('opens with «У МІКСІ» for a Category already in the Mix', async () => {
    await open();
    await renderCategory('emotions-character');

    expect(screen.getByRole('togglebutton', { name: 'У ТЕМАХ' })).toBeTruthy();
    expect(screen.queryByRole('togglebutton', { name: 'ДОДАТИ' })).toBeNull();
  });

  it('keeps the last Category of the Mix in it and says why, as the Mix screen does', async () => {
    await open();
    await composition.mix.setCategory('empty', false);
    await composition.mix.setCategory('nature', false);
    await composition.mix.setCategory('war', false);
    await renderCategory('emotions-character');

    await settle(() => fireEvent.press(screen.getByRole('togglebutton', { name: 'У ТЕМАХ' })));
    expect(hiddenIds()).toEqual(['empty', 'nature', 'war']);
    expect(screen.getByRole('togglebutton', { name: 'У ТЕМАХ' })).toBeTruthy();
    expect(screen.getByText(editionStrings.mix.lastCategoryHint)).toBeTruthy();
  });

  it('lists the Known Words first, then the rest, each in pack order', async () => {
    await open();
    await composition.knowledge.set('w_tykhyi', 'known');
    await composition.knowledge.set('w_lahidnyi', 'known');
    await renderCategory('emotions-character');

    const meanings = screen.getAllByText(/^Значення слова /);
    ['лагідний', 'тихий', 'сумирний'].forEach((lemma, at) => {
      expect(meanings[at]).toHaveTextContent(`Значення слова ${lemma}.`);
    });
    expect(screen.getByTestId('category-entry-w_lahidnyi-known')).toBeTruthy();
    expect(screen.getByTestId('category-entry-w_tykhyi-known')).toBeTruthy();
    expect(screen.queryByTestId('category-entry-w_sumyrnyi-known')).toBeNull();
  });

  it("lists a card per live Word, a Known one first with «ЗНАЮ», and with the Category's Feed off a tap opens its Entry without a Seen", async () => {
    await open({ categoryFeed: false });
    await composition.knowledge.set('w_tykhyi', 'known');
    await renderCategory('emotions-character');

    const meanings = screen.getAllByText(/^Значення слова /);
    expect(meanings).toHaveLength(3);
    ['тихий', 'сумирний', 'лагідний'].forEach((lemma, at) => {
      expect(meanings[at]).toHaveTextContent(`Значення слова ${lemma}.`);
    });
    // The stamp reads «ЗНАЮ»: the Edition's «Знаю» in the stamp's capitals.
    expect(screen.getByTestId('category-entry-w_tykhyi-known')).toHaveTextContent(
      editionStrings.dashboard.category.knownStamp,
    );
    expect(
      within(screen.getByTestId('category-entry-w_tykhyi')).getByText('Значення слова тихий.'),
    ).toBeTruthy();
    expect(screen.queryByTestId('category-entry-w_sumyrnyi-known')).toBeNull();
    expect(screen.getByTestId('category-entry-w_sumyrnyi-bar-3-filled')).toBeTruthy();
    expect(screen.getByTestId('category-entry-w_sumyrnyi-bar-4')).toBeTruthy();

    await settle(() => fireEvent.press(screen.getByTestId('category-entry-w_lahidnyi')));
    expect(screen.queryByTestId('category-hero')).toBeNull();
    expect(screen.getByText('Значення слова лагідний.')).toBeTruthy();
    expect(composition.history.list).toEqual([]);
  });

  it('shows the error with a retry when its read fails, and the retry reads the Words again', async () => {
    await open();
    jest.spyOn(composition, 'categoryEntries').mockRejectedValueOnce(new Error('The pack is busy'));
    await renderCategory('emotions-character');

    const error = screen.getByTestId('category-error');
    expect(within(error).getByText(editionStrings.loadFailed.title)).toBeOnTheScreen();
    expect(screen.queryAllByTestId(/^category-entry-/)).toEqual([]);

    await settle(() => fireEvent.press(within(error).getByText(editionStrings.loadFailed.retry)));
    expect(screen.queryByTestId('category-error')).not.toBeOnTheScreen();
    expect(screen.getAllByText(/^Значення слова /)).toHaveLength(3);
  });

  it('shows the hero and no cards for an empty Category', async () => {
    await open();
    await renderCategory('empty');

    const hero = screen.getByTestId('category-hero');
    expect(within(hero).getByText('КАТЕГОРІЯ · 0 слів')).toBeTruthy();
    expect(within(hero).getByText('Порожня')).toBeTruthy();
    expect(within(hero).getByText('ЗНАЮ 0 З 0')).toBeTruthy();
    expect(screen.queryAllByTestId(/^category-entry-/)).toEqual([]);
  });
});

describe('the quiet Category screen (k3)', () => {
  it('shows «Категорія», the name and description, no right button, no progress and plain rows', async () => {
    await open({ categoryFeed: false });
    await renderCategory('war');

    expect(screen.getByText(editionStrings.dashboard.category.quiet)).toBeTruthy();
    expect(screen.getByText('Війна')).toBeTruthy();
    expect(screen.getByText('Слова, що болять.')).toBeTruthy();
    expect(screen.queryByTestId('category-hero')).toBeNull();
    expect(screen.queryByTestId('category-mix')).toBeNull();
    expect(screen.queryByText(/^ЗНАЮ/)).toBeNull();
    expect(screen.queryByTestId('category-entry-w_vtrata-bar-3')).toBeNull();
    expect(screen.getByText('втрата')).toBeTruthy();

    await settle(() => fireEvent.press(screen.getByTestId('category-entry-w_vtrata')));
    expect(screen.queryByText(editionStrings.dashboard.category.quiet)).toBeNull();
    expect(screen.getByText('Значення слова втрата.')).toBeTruthy();
  });
});

const ACTIVATION = 12;

/** Turns the Category's Feed to its next card. */
async function swipeUp() {
  await act(async () => {
    fireGestureHandler(getByGestureTestId('category-feed-swipe'), [
      { state: State.BEGAN, translationY: 0, velocityY: 0 },
      { state: State.ACTIVE, translationY: -ACTIVATION, velocityY: -1000 },
      { state: State.ACTIVE, translationY: -ACTIVATION, velocityY: -1000 },
      { state: State.ACTIVE, translationY: -400, velocityY: -1000 },
      { state: State.END, translationY: -400, velocityY: -1000 },
    ]);
    await jest.advanceTimersByTimeAsync(500);
  });
}

/** Lays the Category's Feed out on a phone's screen, as the pager draws its pages only then. */
async function layOut() {
  await settle(() =>
    fireEvent(screen.getByTestId('category-feed'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 700 } },
    }),
  );
}

/** The Lemma and the kicker of the Category's Feed card on screen at `position`. */
function cardAt(position: number) {
  const page = within(screen.getByTestId(`category-feed-card-${String(position)}`));
  return {
    kicker: page.getByTestId('word-card-kicker'),
    meaning: page.getByText(/^Значення слова /),
  };
}

describe("the Category's Feed", () => {
  it('opens on the tapped Word with its place, then the next Words in pack order and round again, endlessly', async () => {
    await open();
    await renderCategory('emotions-character');

    await settle(() => fireEvent.press(screen.getByTestId('category-entry-w_lahidnyi')));
    await layOut();

    expect(screen.queryByTestId('category-hero')).toBeNull();
    const lemmas = ['лагідний', 'тихий', 'сумирний', 'лагідний', 'тихий'];
    for (const [position, lemma] of lemmas.entries()) {
      if (position > 0) await swipeUp();
      const card = cardAt(position);
      expect(card.meaning).toHaveTextContent(`Значення слова ${lemma}.`);
      expect(card.kicker).toHaveTextContent(
        `Категорія\u00a0· Емоції\u00a0· ${String((position % 3) + 1)}\u00a0з\u00a03`,
      );
    }
  });

  it('makes nothing Seen and leaves History as it was', async () => {
    await open();
    await renderCategory('emotions-character');

    await settle(() => fireEvent.press(screen.getByTestId('category-entry-w_sumyrnyi')));
    await layOut();
    await swipeUp();
    await settle(() => jest.advanceTimersByTimeAsync(10_000));

    expect(composition.history.list).toEqual([]);
  });

  it('lays a tabbed card in a fixed frame: no page scroll around its tab bar', async () => {
    await open();
    await renderCategory('emotions-character');
    await settle(() => fireEvent.press(screen.getByTestId('category-entry-w_lahidnyi')));
    await layOut();

    const page = within(screen.getByTestId('category-feed-card-0'));
    expect(page.getAllByRole('tab', { includeHiddenElements: true })).not.toEqual([]);
    const scrolls: string[] = [];
    for (let at = page.getByTestId('word-card-kicker').parent; at !== null; at = at.parent)
      if (at.type === 'RCTScrollView') scrolls.push(String(at.props['testID']));
    expect(scrolls).toEqual([]);
  });

  it('reads the cards of the pages it draws, not of every Word of the Category at once', async () => {
    await open();
    await renderCategory('nature');
    const reads = jest.spyOn(composition, 'entryCard');

    await settle(() => fireEvent.press(screen.getByTestId('category-entry-w_lis')));
    await layOut();

    expect(cardAt(0).meaning).toHaveTextContent('Значення слова гайовий.');
    const read = () => new Set(reads.mock.calls.map(([id]) => id));
    // The current page, the next one and the one after it, ready before a swipe.
    expect(read()).toEqual(new Set(['w_lis', 'w_bir', 'w_luh']));
    await swipeUp();
    expect(cardAt(1).meaning).toHaveTextContent('Значення слова бір.');
    expect(read()).toEqual(new Set(['w_lis', 'w_bir', 'w_luh', 'w_dibrova']));
  });

  it('shows the error with a retry, under a back tile, when its read fails, and the retry reads again', async () => {
    await open();
    await renderCategory('emotions-character');
    jest.spyOn(composition, 'categoryEntries').mockRejectedValueOnce(new Error('The pack is busy'));

    await settle(() => fireEvent.press(screen.getByTestId('category-entry-w_lahidnyi')));

    const error = screen.getByTestId('category-feed-error');
    expect(within(error).getByText(editionStrings.loadFailed.title)).toBeOnTheScreen();
    expect(screen.getByTestId('category-feed-back')).toHaveTextContent(editionStrings.back);

    await settle(() => fireEvent.press(within(error).getByText(editionStrings.loadFailed.retry)));
    await layOut();
    expect(screen.queryByTestId('category-feed-error')).not.toBeOnTheScreen();
    expect(cardAt(0).meaning).toHaveTextContent('Значення слова лагідний.');
  });

  it('leads back to the Category screen by its back tile, named for the Category', async () => {
    await open();
    await renderCategory('emotions-character');
    await settle(() => fireEvent.press(screen.getByTestId('category-entry-w_sumyrnyi')));

    await settle(() => fireEvent.press(screen.getByRole('button', { name: 'Емоції' })));

    expect(screen.getByTestId('category-hero')).toBeTruthy();
  });
});
