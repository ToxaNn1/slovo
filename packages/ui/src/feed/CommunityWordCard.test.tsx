import type { EntryRowModel, Haptics } from '@slovo/core';
import { CommunityWordCard, EditionProvider, HapticsProvider, VerticalPager } from '@slovo/ui';
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { testStrings } from '../test-strings';

const strings = testStrings({
  feedNotices: {
    communityWord: {
      title: 'Community word of the week',
      added: { one: '{count} reader added it', other: '{count} readers added it' },
    },
  },
  correctionCard: { insteadOf: 'instead of “{form}”' },
});

/** A Word whose Lemma carries its Stress mark. */
const word: EntryRowModel = {
  kind: 'word',
  entryId: 'w1',
  title: 'me\u0301ek',
  secondLine: 'Quiet and gentle.',
  labelKey: 'word',
  spoken: 'meek, Quiet and gentle.',
  partOfSpeech: 'adjective',
  registers: [],
  rarity: 3,
};

const correction: EntryRowModel = {
  kind: 'correction',
  entryId: 'c1',
  title: 'take into account',
  secondLine: 'take into consideration',
  labelKey: 'correction',
  spoken: 'take into account, take into consideration',
  correctionType: 'calque',
};

const haptics: Haptics = {
  selection: jest.fn(),
  impactLight: jest.fn(),
  impactMedium: jest.fn(),
  success: jest.fn(),
  warning: jest.fn(),
};

/** The Feed's pages: the Community Word card, then the next Entry's card behind it. */
const PAGES = ['communityWord', 'next'] as const;

async function renderFeed(row: EntryRowModel | undefined, adds: number) {
  const onOpen = jest.fn();
  await render(
    <EditionProvider edition={{ locale: 'en' }} strings={strings}>
      <HapticsProvider haptics={haptics}>
        <VerticalPager
          testID="pager"
          items={PAGES}
          onIndexChange={jest.fn()}
          renderPage={(page) =>
            page === 'communityWord' ? (
              <CommunityWordCard row={row} adds={adds} onOpen={onOpen} />
            ) : (
              <Text>Next</Text>
            )
          }
        />
      </HapticsProvider>
    </EditionProvider>,
  );
  // The pages are drawn once the pager knows its height.
  await fireEvent(screen.getByTestId('pager'), 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width: 400, height: 800 } },
  });
  return { onOpen };
}

describe('the Community Word card', () => {
  it('shows its title, the mini card of the Entry and how many readers added it', async () => {
    await renderFeed(word, 12);

    expect(screen.getByTestId('feed-notice-communityWord')).toBeTruthy();
    expect(screen.getByText('Community word of the week')).toBeTruthy();
    expect(screen.getByText('12 readers added it')).toBeTruthy();
    expect(screen.getByLabelText('Community word of the week. 12 readers added it')).toBeTruthy();
    expect(screen.getByText('me\u0301ek')).toBeTruthy();
    expect(screen.getByText('Quiet and gentle.')).toBeTruthy();
  });

  it.each([
    [1, '1 reader added it'],
    [2, '2 readers added it'],
  ])('says %i adds in their plural form', async (adds, text) => {
    await renderFeed(word, adds);

    expect(screen.getByText(text)).toBeTruthy();
  });

  it('opens the Entry on a tap of its mini card, which VoiceOver reads without the Stress mark', async () => {
    const { onOpen } = await renderFeed(word, 12);

    await fireEvent.press(screen.getByRole('button', { name: 'meek, Quiet and gentle.' }));

    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('says a Correction’s mini card in the Edition’s words', async () => {
    await renderFeed(correction, 2);

    expect(screen.getByText('take into account')).toBeTruthy();
    expect(screen.getByText('instead of “take into consideration”')).toBeTruthy();
  });

  it('shows no mini card while the Entry’s row is not read yet', async () => {
    const { onOpen } = await renderFeed(undefined, 12);

    expect(screen.getByText('12 readers added it')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
    expect(onOpen).not.toHaveBeenCalled();
  });
});
