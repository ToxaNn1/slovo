import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Correction } from '@slovo/contracts';
import {
  createMemoryUserStatePort,
  loadEdition,
  openComposition,
  openUserState,
  systemRandom,
  type Composition,
} from '@slovo/core';
import { createMemoryContentPort } from '@slovo/core/testing';
import { EditionProvider } from '@slovo/ui';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import config from 'slovo-edition/config';

import { edition, editionStrings } from '../edition/edition';
import { ShellProvider } from '../shell-value';
import { opened, testShell } from '../shell/test-support';
import { CommunityWordNotice } from './community-word-notice';

/** The Community Word: a Correction of the pack. */
const correction: Correction = {
  kind: 'correction',
  id: 'c_abc123',
  nonStandardForm: 'приймати до уваги',
  correctionType: 'calque',
  standardEquivalents: ['зважати на'],
  explanation: 'Чому краще зважати.',
  examplePair: { nonStandard: 'Прийняти до уваги.', standard: 'Зважати на це.' },
  categoryId: 'everyday',
  sources: [{ title: 'Test source' }],
  literaryUses: [],
  retired: false,
};

/** The composition the card reads the Entry's row from, opened afresh for each test. */
let composition: Composition;

/** The screens the card opens, by their path. */
const mockOpened: string[] = [];
jest.mock('../entries/use-open-screen', () => ({
  useOpenScreen: () => (href: string) => mockOpened.push(href),
}));

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

beforeEach(async () => {
  mockOpened.length = 0;
  composition = await openComposition({
    content: createMemoryContentPort({ corrections: [correction] }),
    edition: loadEdition(config),
    userState: await openUserState({ port: createMemoryUserStatePort(new Map()) }),
    clock: { now: () => new Date('2026-10-26T09:00:00Z'), timeZone: () => 'Europe/Kyiv' },
    random: systemRandom,
  });
});

async function renderNotice(adds: number) {
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <ShellProvider shell={testShell({ composition: opened(composition) })}>
        <EditionProvider edition={edition} strings={editionStrings}>
          <CommunityWordNotice entryId="c_abc123" adds={adds} />
        </EditionProvider>
      </ShellProvider>
    </SafeAreaProvider>,
  );
  // The Entry's row is read once the card is drawn.
  await act(async () => {
    await Promise.resolve();
  });
}

describe('the Community Word card in the Feed', () => {
  it('shows «Слово тижня спільноти», the Entry and how many readers added it', async () => {
    await renderNotice(12);

    expect(screen.getByText('Слово тижня спільноти')).toBeTruthy();
    expect(screen.getByText('додали 12 читачів')).toBeTruthy();
    expect(screen.getByText('зважати на')).toBeTruthy();
    expect(screen.getByText('замість «приймати до уваги»')).toBeTruthy();
  });

  it.each([
    [1, 'додав 1 читач'],
    [3, 'додали 3 читачі'],
    [5, 'додали 5 читачів'],
    [21, 'додав 21 читач'],
    [24, 'додали 24 читачі'],
    [111, 'додали 111 читачів'],
  ])('says %i adds in the Edition’s plural form', async (adds, text) => {
    await renderNotice(adds);

    expect(screen.getByText(text)).toBeTruthy();
  });

  it('opens the Entry over the Feed on a tap', async () => {
    await renderNotice(12);

    await fireEvent.press(screen.getByTestId('community-word-open'));

    expect(mockOpened).toEqual(['/entry/c_abc123']);
  });
});
