import { linkSourceOf, type EntryLinkSource } from '@slovo/core';
import type { ReactElement } from 'react';

import { editionStrings } from '../edition/edition';
import { useQueryParam, useSegmentParam } from '../route-params';
import { useCollectionList } from '../saved/collections';
import { EntryScreen } from './entry-screen';

/** What an Entry route reads from its URL: the Entry, the name of its link back and the stack's own params. */
interface EntryRouteParams {
  readonly entryId: string;
  readonly back: string | undefined;
  readonly from: string | undefined;
  readonly collectionId: string | undefined;
}

/** How one stack opens its Entry screen: the link back without a `back` param, and what opened the Entry. */
interface EntryStack {
  /** The name of the link back when the URL names none; a hook, as a Collection reads its name. */
  useDefaultBack: (params: EntryRouteParams) => string;
  openedFrom: (params: EntryRouteParams) => EntryLinkSource | 'search' | undefined;
}

/** Opened from a list, which makes nothing Seen by its opening (ADR 0054). */
const fromList = (): undefined => undefined;

/** The Collection's name, or the Collections title for a Collection that is gone. */
function useCollectionBack({ collectionId }: EntryRouteParams): string {
  const collection = useCollectionList().find(({ id }) => id === collectionId);
  return collection?.name ?? editionStrings.collections.title;
}

const stacks = {
  /** A link, `slovo-<edition id>://entry/<id>`, or the Feed: a notification or the widget opens it as Seen. */
  link: { useDefaultBack: () => editionStrings.tabs.home, openedFrom: linkSourceOf },
  /** A Search result, which makes nothing Seen (ADR 0054). */
  search: { useDefaultBack: () => editionStrings.search.title, openedFrom: () => 'search' },
  game: { useDefaultBack: () => editionStrings.game.title, openedFrom: fromList },
  history: { useDefaultBack: () => editionStrings.history.title, openedFrom: fromList },
  favorites: { useDefaultBack: () => editionStrings.favorites.title, openedFrom: fromList },
  learning: { useDefaultBack: () => editionStrings.learning.title, openedFrom: fromList },
  wordsOfTheDay: {
    useDefaultBack: () => editionStrings.wordOfTheDayArchive.title,
    openedFrom: fromList,
  },
  collection: { useDefaultBack: useCollectionBack, openedFrom: fromList },
} satisfies Record<string, EntryStack>;

/**
 * The Entry route of one stack, for its `[entryId].tsx` file: the Entry screen
 * of the Entry in the URL, its link back named by the `back` param or the
 * stack's default. The Entries it links open on the same stack.
 */
export function entryRoute(stack: keyof typeof stacks): () => ReactElement {
  const { useDefaultBack, openedFrom }: EntryStack = stacks[stack];
  return function EntryRoute() {
    const params: EntryRouteParams = {
      entryId: useSegmentParam('entryId'),
      back: useQueryParam('back'),
      from: useQueryParam('from'),
      collectionId: useQueryParam('collectionId'),
    };
    const defaultBack = useDefaultBack(params);
    return (
      <EntryScreen
        entryId={params.entryId}
        back={params.back ?? defaultBack}
        openedFrom={openedFrom(params)}
      />
    );
  };
}
