import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  loadEdition,
  type TrackedUserState,
  openComposition,
  systemRandom,
  type Composition,
} from '@slovo/core';
import type { Word } from '@slovo/contracts';
import {
  createFakeBackend,
  createMemoryContentPort,
  type FakeBackend,
  seedUserState,
} from '@slovo/core/testing';
import { act, fireEvent, screen } from '@testing-library/react-native';

import CollectionLinkScreen from '../app/c/[linkId]';
import { activeEditionFiles, edition, editionStrings } from '../edition/edition';
import { opened, switchedTo, testShell } from '../shell/test-support';
import { renderApp } from '../shell/test-app';

const { config } = activeEditionFiles;

/** The composition the sheet reads, opened afresh for each test. */
let composition: Composition;

/** The link id the route hands the sheet. */
let mockLinkId: string;

/** The screens the sheet pushed, in order. */
const mockPushed: string[] = [];

/** The screens the sheet replaced itself with, in order. */
const mockReplaced: string[] = [];

jest.mock('expo-router', () => ({
  ...jest.requireActual<object>('expo-router'),
  useLocalSearchParams: () => ({ linkId: mockLinkId }),
  useRouter: () => ({
    back: () => undefined,
    navigate: (href: string) => {
      mockPushed.push(href);
    },
    push: (href: string) => {
      mockPushed.push(href);
    },
    replace: (href: string) => {
      mockReplaced.push(href);
    },
  }),
}));

const strings = editionStrings.collections.link;

/** A Word with its Lemma and nothing else the sheet reads. */
const word = (id: string, lemma: string): Word => ({
  kind: 'word',
  id,
  lemma,
  stress: [1],
  partOfSpeech: 'adjective',
  primaryDefinition: `The meaning of ${lemma}.`,
  extraDefinitions: [],
  examples: [{ text: `Речення: ${lemma}.` }],
  synonyms: [],
  antonyms: [],
  registers: [],
  categoryId: 'nature',
  rarity: 3,
  sources: [{ title: 'Test source' }],
  correctionIds: [],
  retired: false,
});

/** The Words of the reader's Language Pack. */
const PACK = ['w_one', 'w_two', 'w_three', 'w_four', 'w_five', 'w_six'];

/** An id no link was made with. */
const UNKNOWN_ID = 'Ab3dE5gH9k';

let api: FakeBackend;

/** Whether the reader's user state refuses each write from now on, as a full disk would. */
let writesFail: boolean;

/** The reader's Core over a fake Collection Link backend, which holds no link yet. */
async function open() {
  api = createFakeBackend();
  writesFail = false;
  const seeded = await seedUserState();
  const userState: TrackedUserState = {
    ...seeded,
    write: (changes) =>
      writesFail ? Promise.reject(new Error('The disk is full')) : seeded.write(changes),
  };
  composition = await openComposition({
    content: createMemoryContentPort({
      categories: [{ id: 'nature', displayName: 'Природа', description: 'Природа.', tone: 'loud' }],
      words: PACK.map((id) => word(id, `слово-${id}`)),
    }),
    edition: loadEdition(config),
    userState,
    clock: { now: () => new Date('2026-10-28T09:00:00Z'), timeZone: () => 'Europe/Kyiv' },
    random: systemRandom,
    backend: api.backend,
  });
}

/** Shares a link of the reader's Edition and makes it the one the route opens. */
async function share(name: string, entryIds: string[]) {
  const made = await api.backend.collectionLinks.create({ edition: edition.id, name, entryIds });
  mockLinkId = made.id;
}

/** Lets the sheet's read and the renders after it finish. */
async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

async function renderSheet() {
  await renderApp(<CollectionLinkScreen />, {
    shell: testShell({
      composition: opened(composition),
      remoteSwitches: switchedTo(edition),
    }),
  });
  await settle();
}

beforeEach(async () => {
  mockPushed.length = 0;
  mockReplaced.length = 0;
  await open();
});

describe('the recipient sheet of a Collection Link', () => {
  it('shows the name, how many Entries it holds, its first 5 Entries and «Додати собі»', async () => {
    await share('Осінь', PACK);

    await renderSheet();

    expect(screen.getByText('Осінь')).toBeTruthy();
    expect(screen.getByTestId('collection-link-count').props).toMatchObject({
      children: '6 слів',
    });
    for (const id of PACK.slice(0, 5)) {
      expect(screen.getByTestId(`entry-row-${id}`)).toBeTruthy();
    }
    expect(screen.queryByTestId('entry-row-w_six')).toBeNull();
    expect(screen.getByRole('button', { name: strings.add })).toBeTruthy();
    expect(screen.queryByTestId('collection-link-skipped')).toBeNull();
  });

  it('reads to VoiceOver as its name, its count, each Entry without the Stress mark and «Додати собі»', async () => {
    await share('Осінь', ['w_one', 'w_two', 'w_gone0']);

    await renderSheet();

    expect(screen.getByRole('button', { name: editionStrings.tabs.home })).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Осінь' })).toBeOnTheScreen();
    expect(screen.getByText('3 слова')).toBeOnTheScreen();
    for (const id of ['w_one', 'w_two']) {
      // The row shows the Lemma with its Stress mark; VoiceOver reads it without.
      expect(screen.getByTestId(`entry-row-${id}-text`)).toHaveTextContent(/\u0301/);
      expect(screen.getByTestId(`entry-row-${id}-text`)).toHaveProp(
        'accessibilityLabel',
        `слово-${id}, The meaning of слово-${id}.`,
      );
    }
    expect(screen.getByText('1 слово недоступне')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: strings.add })).toBeEnabled();
  });

  it('shows that it is loading until the link is read', async () => {
    jest
      .spyOn(composition.collectionLinkCopy, 'preview')
      .mockReturnValue(new Promise(() => undefined));
    mockLinkId = UNKNOWN_ID;

    await renderSheet();

    expect(screen.getByTestId('collection-link-loading')).toBeOnTheScreen();
    expect(screen.queryByTestId('collection-link-failure')).toBeNull();
  });

  it('«Додати собі» makes the reader’s own Collection of it, which takes the link screen’s place', async () => {
    await share('Осінь', ['w_two', 'w_one']);
    await renderSheet();
    expect(screen.queryByTestId('collection-link-loading')).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: strings.add }));
    await settle();

    const [copy] = composition.collections.list;
    expect(copy?.name).toBe('Осінь');
    const copied = composition.collections.entries(copy?.id ?? '').map((e) => e.entryId);
    expect(copied.toSorted()).toEqual(['w_one', 'w_two']);
    expect(mockReplaced).toEqual([`/saved/collections/${copy?.id ?? ''}`]);
    expect(mockPushed).toEqual([]);
  });

  it('a second «Додати собі» opens the copy made and makes no «(2)»', async () => {
    await share('Осінь', ['w_two', 'w_one']);
    await renderSheet();

    await fireEvent.press(screen.getByRole('button', { name: strings.add }));
    await settle();
    await fireEvent.press(screen.getByRole('button', { name: strings.add }));
    await settle();

    const [copy, ...more] = composition.collections.list;
    expect(more).toEqual([]);
    const href = `/saved/collections/${copy?.id ?? ''}`;
    expect(mockReplaced).toEqual([href, href]);
  });

  it('says when «Додати собі» could not make the copy, and opens nothing', async () => {
    await share('Осінь', ['w_two', 'w_one']);
    await renderSheet();
    writesFail = true;

    await fireEvent.press(screen.getByRole('button', { name: strings.add }));

    expect(
      await screen.findByTestId('undo-toast-message', {}, { timeout: 10_000 }),
    ).toHaveTextContent(strings.addFailed);
    expect(composition.collections.list).toEqual([]);
    expect(mockPushed).toEqual([]);
    expect(mockReplaced).toEqual([]);
  });

  it('with none of its Entries in the pack, shows only how many are unavailable and disables «Додати собі»', async () => {
    await share('Осінь', ['w_gone0', 'w_gone1']);
    await renderSheet();

    expect(screen.getByTestId('collection-link-skipped').props).toMatchObject({
      children: '2 слова недоступні',
    });
    expect(screen.queryByTestId(/^entry-row-/)).toBeNull();
    const add = screen.getByRole('button', { name: strings.add });
    expect(add).toBeDisabled();

    await fireEvent.press(add);
    await settle();

    expect(composition.collections.list).toEqual([]);
    expect(mockPushed).toEqual([]);
    expect(mockReplaced).toEqual([]);
  });

  it.each([
    [1, '1 слово недоступне', '2 слова'],
    [2, '2 слова недоступні', '3 слова'],
    [5, '5 слів недоступні', '6 слів'],
  ])(
    'says how many of its Entries the pack lacks, in the plural form: %i → «%s» of «%s»',
    async (missing, text, held) => {
      await share('Осінь', [
        'w_one',
        ...Array.from({ length: missing }, (_, i) => `w_gone${String(i)}`),
      ]);

      await renderSheet();

      expect(screen.getByTestId('collection-link-skipped').props).toMatchObject({
        children: text,
      });
      expect(screen.getByTestId('collection-link-count').props).toMatchObject({
        children: held,
      });
    },
  );

  it('says «Немає з’єднання» offline under the Mascot asleep, with nothing to add', async () => {
    await share('Осінь', PACK);
    api.online = false;

    await renderSheet();

    expect(screen.getByText(strings.offline)).toBeTruthy();
    expect(screen.getByTestId('mascot-sleeps')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: strings.add })).toBeNull();
  });

  it('«Спробувати ще» offline reads the link again once the connection is back', async () => {
    await share('Осінь', PACK);
    api.online = false;
    await renderSheet();

    api.online = true;
    await fireEvent.press(screen.getByRole('button', { name: 'Спробувати ще' }));

    expect(await screen.findByText('Осінь')).toBeTruthy();
    expect(screen.queryByText(strings.offline)).toBeNull();
    expect(screen.getByRole('button', { name: strings.add })).toBeTruthy();
  });

  it('says an unknown link isn’t available, with nothing to add', async () => {
    mockLinkId = UNKNOWN_ID;

    await renderSheet();

    expect(screen.getByText(strings.notFound)).toBeTruthy();
    expect(screen.queryByTestId(/^mascot-/)).toBeNull();
    expect(screen.queryByRole('button', { name: strings.add })).toBeNull();
  });
});
