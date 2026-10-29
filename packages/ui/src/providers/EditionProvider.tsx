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
  readonly Pronunciation: ComponentType<{ lemma: string }> | undefined;
  /** The Illustrations the app bundles, by file name; a Word naming any other file shows none. */
  readonly illustrations: Readonly<Record<string, ImageSourcePropType>>;
}

/** No bundled Illustrations, for an Edition that brings none. */
const NO_ILLUSTRATIONS: Readonly<Record<string, ImageSourcePropType>> = {};

const EditionContext = createContext<EditionPresentation | undefined>(undefined);

/**
 * Gives every component below the Edition's strings and language, and the
 * Pronunciation button the shell connects to the device's voice, and the
 * Illustrations the app bundles as Edition assets (ADR 0055). Category
 * names come with the cards, from the Language Pack (ADR 0033).
 */
export function EditionProvider({
  edition,
  strings,
  pronunciation,
  illustrations = NO_ILLUSTRATIONS,
  children,
}: {
  edition: Pick<Edition, 'locale'>;
  strings: EditionStrings;
  pronunciation?: ComponentType<{ lemma: string }>;
  illustrations?: Readonly<Record<string, ImageSourcePropType>>;
  children: ReactNode;
}) {
  const value = useMemo(
    (): EditionPresentation => ({
      strings,
      voice: { accessibilityLanguage: edition.locale },
      count: pluralCount(edition.locale),
      Pronunciation: pronunciation,
      illustrations,
    }),
    [edition, strings, pronunciation, illustrations],
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
