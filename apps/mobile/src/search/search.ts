import type { Composition, EntryRowModel, SearchResults } from '@slovo/core';
import { useCallback, useEffect, useState } from 'react';

import { useComposition } from '../composition';
import { logError } from '../diagnostics/log';
import { editionStrings } from '../edition/edition';
import { useOpenScreen } from '../entries/use-open-screen';

/** A group of the Search screen: the kind of Entry its results are. */
export type SearchGroupName = keyof SearchResults;

/** One group of results, under its kind's chip («Слова», «Виправлення», …). */
export interface SearchGroup {
  readonly name: SearchGroupName;
  readonly title: string;
  readonly data: readonly EntryRowModel[];
}

/** What the Search screen shows for a query. */
export interface SearchScreenModel {
  /** The groups that found anything, in the order of the kinds. */
  readonly groups: readonly SearchGroup[];
  /** Whether Search answered the query and found nothing: «Нічого не знайдено». */
  readonly nothingFound: boolean;
}

/** The groups in the order the screen shows them. */
const groupOrder: readonly SearchGroupName[] = [
  'words',
  'corrections',
  'idioms',
  'synonymRows',
  'tips',
];

const nothingYet: SearchScreenModel = { groups: [], nothingFound: false };

/** The screen's model for a query: each kind's results as Entry rows, the empty groups left out. */
async function searchScreenModel(
  composition: Composition,
  query: string,
): Promise<SearchScreenModel> {
  if (!composition.search.answers(query)) return nothingYet;
  const results = await composition.search.search(query);
  const groups = await Promise.all(
    groupOrder.map(async (name) => {
      const rows = await Promise.all(results[name].map(({ id }) => composition.entryRow(id)));
      return {
        name,
        title: editionStrings.search.groups[name],
        data: rows.filter((row) => row !== undefined),
      };
    }),
  );
  const found = groups.filter(({ data }) => data.length > 0);
  return { groups: found, nothingFound: found.length === 0 };
}

/**
 * The results of the query as typed, read again on each change of it. The
 * results of a query typed over come too late and are dropped, so the screen
 * always shows the last one's.
 */
export function useSearchScreen(query: string): SearchScreenModel {
  const composition = useComposition();
  const [model, setModel] = useState(nothingYet);
  useEffect(() => {
    let active = true;
    searchScreenModel(composition, query).then(
      (found) => {
        if (active) setModel(found);
      },
      (error: unknown) => {
        logError('Could not search', error);
      },
    );
    return () => {
      active = false;
    };
  }, [composition, query]);
  return model;
}

/**
 * Opens a result's Entry card over Search, and keeps the query it was opened
 * from among the recent queries. Opening it makes nothing Seen (ADR 0054).
 */
export function useOpenSearchResult(query: string): (entryId: string) => void {
  const composition = useComposition();
  const openScreen = useOpenScreen();
  return useCallback(
    (entryId: string) => {
      composition.recentQueries.resultOpened(query).catch((error: unknown) => {
        logError('Could not keep the recent query', error);
      });
      openScreen(`/search/${entryId}?back=${encodeURIComponent(editionStrings.search.title)}`);
    },
    [composition, openScreen, query],
  );
}
