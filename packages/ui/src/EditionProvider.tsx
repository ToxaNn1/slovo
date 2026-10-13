import type { EditionStrings, Plural } from '@slovo/contracts';
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
  /** The display name of a Category of the Edition, by id. */
  categoryName(categoryId: string): string | undefined;
  /** A count in the plural form the Edition's language takes for it, e.g. «17 записів». */
  readonly count: (forms: Plural, count: number) => string;
  /** The Pronunciation button for a Lemma; a Word card has none without it. */
  readonly Pronunciation: ComponentType<{ lemma: string }> | undefined;
}

const EditionContext = createContext<EditionPresentation | undefined>(undefined);

/**
 * Gives every component below the Edition's strings, language and Category
 * names, and the Pronunciation button the shell connects to the device's voice.
 */
export function EditionProvider({
  edition,
  strings,
  pronunciation,
  children,
}: {
  edition: Pick<Edition, 'locale' | 'categories'>;
  strings: EditionStrings;
  pronunciation?: ComponentType<{ lemma: string }>;
  children: ReactNode;
}) {
  const value = useMemo((): EditionPresentation => {
    const names = new Map(edition.categories.map(({ id, displayName }) => [id, displayName]));
    const pluralRules = new Intl.PluralRules(edition.locale);
    return {
      strings,
      voice: { accessibilityLanguage: edition.locale },
      categoryName: (categoryId) => names.get(categoryId),
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

/** `{name}` placeholders filled from `values`. */
export function fill(template: string, values: Readonly<Record<string, string>>): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) => values[name] ?? match);
}
