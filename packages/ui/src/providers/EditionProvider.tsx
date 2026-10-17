import { fill, type EditionStrings, type Plural } from '@slovo/contracts';
import type { Edition } from '@slovo/core';
import { createContext, useContext, useMemo, type ComponentType, type ReactNode } from 'react';

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
}

const EditionContext = createContext<EditionPresentation | undefined>(undefined);

/**
 * Gives every component below the Edition's strings and language, and the
 * Pronunciation button the shell connects to the device's voice. Category
 * names come with the cards, from the Language Pack (ADR 0033).
 */
export function EditionProvider({
  edition,
  strings,
  pronunciation,
  children,
}: {
  edition: Pick<Edition, 'locale'>;
  strings: EditionStrings;
  pronunciation?: ComponentType<{ lemma: string }>;
  children: ReactNode;
}) {
  const value = useMemo((): EditionPresentation => {
    const pluralRules = new Intl.PluralRules(edition.locale);
    return {
      strings,
      voice: { accessibilityLanguage: edition.locale },
      count: (forms, count) =>
        fill(forms[pluralRules.select(count)] ?? forms.other, { count: String(count) }),
      Pronunciation: pronunciation,
    };
  }, [edition, strings, pronunciation]);
  return <EditionContext value={value}>{children}</EditionContext>;
}

/** The Edition in effect. The Core has no strings of its own, so it needs a provider. */
export function useEdition(): EditionPresentation {
  const edition = useContext(EditionContext);
  if (edition === undefined) throw new Error('useEdition needs an EditionProvider above it');
  return edition;
}

export { fill };
