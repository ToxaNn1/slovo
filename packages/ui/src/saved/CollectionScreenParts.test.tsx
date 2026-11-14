import type { EntryRowModel } from '@slovo/core';
import {
  CollectionHeader,
  CollectionShareButton,
  CollectionWordRow,
  coreTokens,
  EditionProvider,
  TokensProvider,
} from '@slovo/ui';
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { testStrings } from '../test-strings';

const strings = testStrings({
  collections: { entries: { remove: 'Remove', removeLabel: 'Remove «{title}» from «{name}»' } },
  correctionCard: { insteadOf: 'instead of {form}' },
});

const word: EntryRowModel = {
  kind: 'word',
  entryId: 'w1',
  title: 'ríver',
  secondLine: 'what river means',
  labelKey: 'word',
  spoken: 'river, what river means',
  partOfSpeech: 'noun',
  gender: undefined,
  registers: [],
  rarity: 3,
};

const within = (children: ReactNode) =>
  render(
    <GestureHandlerRootView>
      <TokensProvider tokens={coreTokens} colorScheme="light">
        <EditionProvider edition={{ locale: 'en' }} strings={strings}>
          {children}
        </EditionProvider>
      </TokensProvider>
    </GestureHandlerRootView>,
  );

describe('CollectionHeader', () => {
  it('shows the name and the count, and goes back or opens the menu', async () => {
    const back = jest.fn();
    const menu = jest.fn();
    await within(
      <CollectionHeader
        name="For essays"
        count="5 words"
        back={{ label: 'Collections', onPress: back }}
        menu={{ label: 'Actions', open: false, onPress: menu }}
      />,
    );

    expect(screen.getByRole('header', { name: 'For essays' })).toBeOnTheScreen();
    expect(screen.getByText('5 words')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Collections' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Actions' }));
    expect(back).toHaveBeenCalledTimes(1);
    expect(menu).toHaveBeenCalledTimes(1);
  });

  it('has no menu while the Collection is gone', async () => {
    await within(
      <CollectionHeader
        name=""
        count="0 words"
        back={{ label: 'Collections', onPress: jest.fn() }}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Actions' })).toBeNull();
  });
});

describe('CollectionWordRow', () => {
  it('opens the Entry and takes it out of the Collection', async () => {
    const open = jest.fn();
    const remove = jest.fn();
    await within(
      <CollectionWordRow
        entry={{ entryId: 'w1', row: word, addedAt: new Date('2026-10-13T09:00:00Z') }}
        collectionName="For essays"
        onPress={open}
        onRemove={remove}
      />,
    );

    expect(screen.getByText('what river means')).toBeOnTheScreen();
    await fireEvent.press(screen.getByText('ríver'));
    await fireEvent(screen.getByTestId('collection-row-w1-open'), 'accessibilityAction', {
      nativeEvent: { actionName: 'remove' },
    });
    expect(open).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledTimes(1);
  });
});

describe('CollectionShareButton', () => {
  it('shares the Collection', async () => {
    const share = jest.fn();
    await within(<CollectionShareButton label="Share link" onPress={share} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Share link' }));
    expect(share).toHaveBeenCalledTimes(1);
  });
});
