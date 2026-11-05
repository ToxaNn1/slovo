import { ConcealedProvider } from '../entries/self-check';
import { CornerActions, EditionProvider, EntryMenuSheet, type EntryMenuMarks } from '@slovo/ui';
import type { KnowledgeMark } from '@slovo/core';
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { testStrings } from '../test-strings';

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

const strings = testStrings({
  knowledge: {
    swipe: {
      menu: {
        open: 'More',
        marks: { known: 'Know', unknown: 'Don’t know', correctionKnown: 'I say it right' },
        changeToUnknown: 'Change to Don’t know',
        changeToKnown: 'Change to Know',
        clear: 'Clear mark',
        share: 'Share',
        hide: 'Hide',
        report: 'Report',
        close: 'Close',
      },
    },
  },
});

async function renderIn(children: ReactNode) {
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <EditionProvider edition={{ locale: 'en' }} strings={strings}>
        {children}
      </EditionProvider>
    </SafeAreaProvider>,
  );
}

function marksOf(mark: KnowledgeMark | undefined) {
  const onSet = jest.fn<(mark: KnowledgeMark) => void>();
  const onClear = jest.fn();
  const marks: EntryMenuMarks = { mark, onSet, onClear };
  return { marks, onSet, onClear };
}

function labels(): string[] {
  return screen.getAllByRole('button').map((button) => String(button.props['accessibilityLabel']));
}

describe('EntryMenuSheet', () => {
  it('heads the sheet with the Entry and offers Know and Don’t know with no mark', async () => {
    const { marks, onSet } = marksOf(undefined);
    await renderIn(
      <EntryMenuSheet
        visible
        entryTitle="Lemma"
        entryKind="word"
        marks={marks}
        onClose={jest.fn()}
      />,
    );

    expect(screen.getByText('Lemma')).toBeOnTheScreen();
    expect(labels()).toEqual(['Know', 'Don’t know', 'Close']);
    await fireEvent.press(screen.getByRole('button', { name: 'Don’t know' }));
    expect(onSet).toHaveBeenCalledWith('unknown');
  });

  it('says a Correction’s Know as already saying it right', async () => {
    const { marks, onSet } = marksOf(undefined);
    await renderIn(
      <EntryMenuSheet
        visible
        entryTitle="x"
        entryKind="correction"
        marks={marks}
        onClose={jest.fn()}
      />,
    );

    await fireEvent.press(screen.getByRole('button', { name: 'I say it right' }));
    expect(onSet).toHaveBeenCalledWith('known');
  });

  it('changes a Known mark to Unknown, or clears it', async () => {
    const { marks, onSet, onClear } = marksOf('known');
    await renderIn(
      <EntryMenuSheet visible entryTitle="x" entryKind="word" marks={marks} onClose={jest.fn()} />,
    );

    expect(labels()).toEqual(['Change to Don’t know', 'Clear mark', 'Close']);
    await fireEvent.press(screen.getByRole('button', { name: 'Change to Don’t know' }));
    expect(onSet).toHaveBeenCalledWith('unknown');
    await fireEvent.press(screen.getByRole('button', { name: 'Clear mark' }));
    expect(onClear).toHaveBeenCalled();
  });

  it('changes an Unknown mark to Known', async () => {
    const { marks, onSet } = marksOf('unknown');
    await renderIn(
      <EntryMenuSheet visible entryTitle="x" entryKind="idiom" marks={marks} onClose={jest.fn()} />,
    );

    expect(labels()).toEqual(['Change to Know', 'Clear mark', 'Close']);
    await fireEvent.press(screen.getByRole('button', { name: 'Change to Know' }));
    expect(onSet).toHaveBeenCalledWith('known');
  });

  it('leaves the mark items out while Self-check conceals the card', async () => {
    const { marks } = marksOf(undefined);
    await renderIn(
      <ConcealedProvider value>
        <EntryMenuSheet visible entryTitle="x" entryKind="word" marks={marks} onClose={jest.fn()} />
      </ConcealedProvider>,
    );

    expect(labels()).toEqual(['Close']);
  });

  it('offers share, hide and report when given, and closes', async () => {
    const onShare = jest.fn();
    const onHide = jest.fn();
    const onReport = jest.fn();
    const onClose = jest.fn();
    await renderIn(
      <EntryMenuSheet
        visible
        entryTitle="x"
        entryKind="tip"
        onShare={onShare}
        onHide={onHide}
        onReport={onReport}
        onClose={onClose}
      />,
    );

    expect(labels()).toEqual(['Share', 'Hide', 'Report', 'Close']);
    await fireEvent.press(screen.getByRole('button', { name: 'Share' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Hide' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Report' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Close' }));
    expect([onShare, onHide, onReport, onClose].map((fn) => fn.mock.calls.length)).toEqual([
      1, 1, 1, 1,
    ]);
  });
});

describe('CornerActions', () => {
  it('opens the menu from its «⋯» button', async () => {
    const onMore = jest.fn();
    await renderIn(<CornerActions onMore={onMore} />);

    await fireEvent.press(screen.getByRole('button', { name: 'More' }));
    expect(onMore).toHaveBeenCalled();
  });
});
