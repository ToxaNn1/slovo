import { type WordFeedCard } from '@slovo/core/testing';
import { EditionProvider, EntryCard } from '@slovo/ui';
import { describe, expect, it } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { useSyncExternalStore, type ReactNode } from 'react';
import type { ImageSourcePropType } from 'react-native';
import { testStrings } from '../test-strings';

const strings = testStrings({
  wordCard: {
    partsOfSpeech: { noun: { short: 'n.', full: 'noun' } },
    genders: {},
    partOfSpeechWithGender: '{partOfSpeech}, {gender}',
    stress: 'stress on {vowels}',
    stressOr: 'or',
    illustration: 'Illustration of the word {lemma}',
    reveal: 'Show the meaning',
  },
});

/** A Word whose Illustration the fake media holds by its Word id. */
const word: WordFeedCard = {
  kind: 'word',
  entryId: 'w1',
  model: {
    kind: 'word',
    wordId: 'w1',
    lemma: 'ábacus',
    stressedVowels: ['a'],
    partOfSpeech: 'noun',
    gender: undefined,
    primaryDefinition: 'A frame with beads for counting.',
    example: undefined,
    synonyms: [],
    antonyms: [],
    registers: [],
    region: undefined,
    history: undefined,
    categoryId: 'k1',
    categoryName: undefined,
    details: undefined,
    linkedCorrections: [],
    synonymRow: undefined,
    sourceNames: [],
  },
};

/**
 * A fake of the app's media: the Illustration of each Word id it holds, as
 * the Starter Media asset or a cached file gives it, and a file that arrives
 * later, as a download does.
 */
function fakeMedia(held: Record<string, ImageSourcePropType>) {
  let files = held;
  const listeners = new Set<() => void>();
  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };
  return {
    useIllustration: (wordId: string) => useSyncExternalStore(subscribe, () => files[wordId]),
    arrive(wordId: string, source: ImageSourcePropType) {
      files = { ...files, [wordId]: source };
      for (const listener of listeners) listener();
    },
  };
}

function inEdition(children: ReactNode, media = fakeMedia({ w1: 7 })) {
  return (
    <EditionProvider
      edition={{ locale: 'en' }}
      strings={strings}
      useIllustration={media.useIllustration}
    >
      {children}
    </EditionProvider>
  );
}

const label = 'Illustration of the word abacus';

describe('The Illustration on a Word card', () => {
  it('shows the Word’s image above the Definition, read by VoiceOver with the Lemma', async () => {
    await render(inEdition(<EntryCard card={word} />));

    const image = screen.getByRole('image', { name: label });
    expect(image).toHaveProp('source', 7);
    expect(image).toHaveStyle({ height: 160 });
    const drawn = JSON.stringify(screen.toJSON());
    expect(drawn.indexOf(label)).toBeLessThan(drawn.indexOf('A frame with beads for counting.'));
  });

  it('does nothing when tapped', async () => {
    await render(inEdition(<EntryCard card={word} />));

    const image = screen.getByRole('image', { name: label });
    expect(image).not.toHaveProp('onPress');
    await fireEvent.press(image);
    expect(screen.getByRole('image', { name: label })).toBeTruthy();
  });

  it('is absent while the media holds no file for the Word, and fills in when it arrives', async () => {
    const media = fakeMedia({});
    await render(inEdition(<EntryCard card={word} />, media));

    expect(screen.queryByRole('image')).toBeNull();
    expect(screen.getByText('A frame with beads for counting.')).toBeTruthy();
    await act(() => {
      media.arrive('w1', { uri: 'file:///cache/media/illustrations~w1.h1.png' });
    });
    expect(screen.getByRole('image', { name: label })).toHaveProp('source', {
      uri: 'file:///cache/media/illustrations~w1.h1.png',
    });
  });

  it('is absent with no media given, as for an Edition that brings no Illustrations', async () => {
    await render(
      <EditionProvider edition={{ locale: 'en' }} strings={strings}>
        <EntryCard card={word} />
      </EditionProvider>,
    );

    expect(screen.queryByRole('image')).toBeNull();
  });

  it('stays hidden with the meaning under Self-check', async () => {
    await render(inEdition(<EntryCard card={word} selfCheck />));

    expect(screen.queryByRole('image')).toBeNull();
    await fireEvent.press(screen.getByText('Show the meaning'));
    expect(screen.getByRole('image', { name: label })).toBeTruthy();
  });
});
