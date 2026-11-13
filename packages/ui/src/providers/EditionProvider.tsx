import { fill, pluralCount, type EditionStrings, type Plural } from '@slovo/contracts';
import type { Edition } from '@slovo/core';
import { createContext, useContext, useMemo, type ComponentType, type ReactNode } from 'react';
import type { ImageSourcePropType } from 'react-native';

/** What the components below take from the Edition: its words and its voice. */
export interface EditionPresentation {
  /** The Edition's UI strings. */
  readonly strings: EditionStrings;
  /**
   * The props that make VoiceOver read in the Edition's language (BCP 47).
   * Spread them on every element it reads.
   */
  readonly voice: { readonly accessibilityLanguage: string };
  /** A count in the plural form the Edition's language takes for it, e.g. «17 записів». */
  readonly count: (forms: Plural, count: number) => string;
  /** The Pronunciation button for a Lemma; a Word card has none without it. */
  readonly Pronunciation: ComponentType<{ lemma: string; entryId: string }> | undefined;
  /**
   * The hook that gives a Word's Illustration by its Word id, from the media
   * the shell connects (ADR 0099): none while the device has no file for it,
   * and the image once the file arrives.
   */
  readonly useIllustration: (wordId: string) => ImageSourcePropType | undefined;
}

/** No Illustrations, for an Edition that brings none. */
const noIllustration = (_wordId: string): ImageSourcePropType | undefined => undefined;

const EditionContext = createContext<EditionPresentation | undefined>(undefined);

/**
 * Gives every component below the Edition's strings and language, and the
 * Pronunciation button the shell connects to the device's voice, and the
 * hook that gives each Word's Illustration from the media (ADR 0055, 0099). Category
 * names come with the cards, from the Language Pack (ADR 0033).
 */
export function EditionProvider({
  edition,
  strings,
  pronunciation,
  useIllustration = noIllustration,
  children,
}: {
  edition: Pick<Edition, 'locale'>;
  strings: EditionStrings;
  pronunciation?: ComponentType<{ lemma: string; entryId: string }>;
  useIllustration?: (wordId: string) => ImageSourcePropType | undefined;
  children: ReactNode;
}) {
  const value = useMemo(
    (): EditionPresentation => ({
      strings,
      voice: { accessibilityLanguage: edition.locale },
      count: pluralCount(edition.locale),
      Pronunciation: pronunciation,
      useIllustration,
    }),
    [edition.locale, strings, pronunciation, useIllustration],
  );
  return <EditionContext value={value}>{children}</EditionContext>;
}

/** The Edition in effect. The Core has no strings of its own, so it needs a provider. */
export function useEdition(): EditionPresentation {
  const edition = useContext(EditionContext);
  if (edition === undefined) throw new Error('useEdition needs an EditionProvider above it');
  return edition;
}

export { fill };
