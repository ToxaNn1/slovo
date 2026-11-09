import type { CuratedCollection } from '@slovo/contracts';

import type { Edition } from '../edition/edition';
import type { Entries } from '../entries/entries';
import { buildEntryRow, type EntryRowModel } from '../entries/entry-row';
import { createSubscribers } from '../in-turn';
import { todayKey, type LocalDate } from '../local-date';
import { knowledgeRecords } from '../knowledge/records';
import type { HiddenEntries } from '../mix/hidden-entries';
import type { Clock, ContentReadPort } from '../ports';
import type { Collection, Collections } from '../saved/collections';
import type { UserState } from '../user-state/user-state';
import { dashboardRecords } from './records';

/** The rail shows this many cards at most. */
const RAIL_LENGTH = 10;

/** One card of the Curated Collections rail: «Нова» until the reader opens it. */
export interface CuratedCollectionCard {
  readonly collection: CuratedCollection;
  readonly state: 'new' | 'opened';
  /** «Додано ✓»: one of the reader's Collections is a copy of it. */
  readonly added: boolean;
}

/** An Entry on a Curated Collection's screen. */
export interface CuratedCollectionEntry {
  readonly entryId: string;
  /** What its row in a list shows. */
  readonly row: EntryRowModel;
  /** Whether its Knowledge Mark is Known. */
  readonly known: boolean;
}

/**
 * A Curated Collection's screen: its Entries in the Language Pack's order,
 * the Retired and the Hidden ones left out, and «Знаю {known} з {total}».
 */
export interface CuratedCollectionScreen {
  readonly collection: CuratedCollection;
  readonly entries: readonly CuratedCollectionEntry[];
  /** X: the Entries marked Known. */
  readonly known: number;
  /** N: the Entries, neither Retired nor Hidden. */
  readonly total: number;
  /** «Додано ✓»: one of the reader's Collections is a copy of it. */
  readonly added: boolean;
}

/**
 * The Curated Collections (ADR 0076): the Dashboard's «Добірки» rail of the
 * Language Pack's editorial Entry sets. A collection is on the rail from its
 * publication date in the local calendar; the unopened ones come first, then
 * the newest, ten at most. With `curatedCollections` off the rail is empty.
 */
export interface CuratedCollections {
  /** The cards in display order. A change makes a new array and tells the subscribers. */
  readonly rail: readonly CuratedCollectionCard[];
  /**
   * Calls `listener` after each change of the rail, and of what a screen
   * shows (a Knowledge Mark, a Hidden Entry, a copy). Returns the call that stops it.
   */
  subscribe(listener: () => void): () => void;
  /** Marks the collection opened, once; the rail follows. An unknown id changes nothing. */
  open(collectionId: string): Promise<void>;
  /**
   * The screen of a collection on the rail's terms (published by today, the
   * switch on); nothing for any other id. Opening an Entry from it goes
   * through `entryCard`, which makes nothing Seen (ADR 0076).
   */
  screen(collectionId: string): Promise<CuratedCollectionScreen | undefined>;
  /**
   * «+ Додати»: copies the collection into the reader's Collections through
   * the Collection copy of «Додати собі», its name under the duplicate-name
   * rule, its Entries in order with the Retired ones skipped, recording its id
   * as the source. Nothing for an id without a screen, or once a copy is kept
   * or is being made (a double tap makes one copy).
   */
  add(collectionId: string): Promise<Collection | undefined>;
}

export async function openCuratedCollections({
  edition,
  content,
  userState,
  clock,
  dayTurned,
  entries,
  collections,
  hiddenEntries,
  knowledge,
}: {
  edition: Pick<Edition, 'isFeatureEnabled'>;
  content: Pick<ContentReadPort, 'listCuratedCollections'>;
  userState: Pick<UserState, 'list' | 'write'>;
  entries: Pick<Entries, 'getManyOfAnyKind'>;
  collections: Pick<Collections, 'list' | 'createCopy' | 'subscribe'>;
  hiddenEntries: Pick<HiddenEntries, 'has' | 'subscribe'>;
  knowledge: { subscribe(listener: () => void): unknown };
  /** Tells today, from which the published collections are those on the rail. */
  clock: Clock;
  dayTurned: { subscribe(listener: (day: LocalDate) => unknown): unknown };
}): Promise<CuratedCollections> {
  const subscribers = createSubscribers();
  const on = edition.isFeatureEnabled('curatedCollections');
  const records = dashboardRecords.curatedCollectionsOpened;
  // The pack is read once: its collections change only with the pack.
  const all = on ? await content.listCuratedCollections() : [];

  async function openedIds(): Promise<ReadonlySet<string>> {
    return new Set((await userState.list(records)).keys());
  }

  const isAdded = (collectionId: string) =>
    collections.list.some(({ source }) => source === collectionId);

  /** The collection on the rail's terms: published by today. */
  const published = (collectionId: string) =>
    all.find(({ id, publishedOn }) => id === collectionId && publishedOn <= todayKey(clock));

  /** The live Entries of the collection in its order: the Retired ones skipped. */
  async function liveEntries(collection: CuratedCollection) {
    const found = await entries.getManyOfAnyKind(collection.entryIds);
    return collection.entryIds.flatMap((id) => {
      const entry = found.get(id);
      return entry === undefined || entry.retired ? [] : [entry];
    });
  }

  async function railOf(): Promise<readonly CuratedCollectionCard[]> {
    const today = todayKey(clock);
    const opened = await openedIds();
    return all
      .filter(({ publishedOn }) => publishedOn <= today)
      .map((collection): CuratedCollectionCard => ({
        collection,
        state: opened.has(collection.id) ? 'opened' : 'new',
        added: isAdded(collection.id),
      }))
      .sort(
        (one, other) =>
          Number(one.state === 'opened') - Number(other.state === 'opened') ||
          other.collection.publishedOn.localeCompare(one.collection.publishedOn) ||
          one.collection.id.localeCompare(other.collection.id),
      )
      .slice(0, RAIL_LENGTH);
  }

  /** The collections whose copy is being made. */
  const adding = new Set<string>();

  let rail = await railOf();
  async function refresh(): Promise<void> {
    rail = await railOf();
    subscribers.tell();
  }
  if (on) {
    dayTurned.subscribe(() => refresh());
    collections.subscribe(() => void refresh());
    hiddenEntries.subscribe(() => {
      subscribers.tell();
    });
    knowledge.subscribe(() => {
      subscribers.tell();
    });
  }

  return {
    get rail() {
      return rail;
    },
    subscribe: subscribers.subscribe,
    async open(collectionId) {
      if (!all.some(({ id }) => id === collectionId)) return;
      if ((await openedIds()).has(collectionId)) return;
      await userState.write(records.record(collectionId).change(true));
      await refresh();
    },
    async screen(collectionId) {
      const collection = published(collectionId);
      if (collection === undefined) return undefined;
      const [live, marks] = await Promise.all([
        liveEntries(collection),
        userState.list(knowledgeRecords.knowledge),
      ]);
      const shown = live
        .filter(({ id }) => !hiddenEntries.has(id))
        .map((entry): CuratedCollectionEntry => ({
          entryId: entry.id,
          row: buildEntryRow(entry),
          known: marks.get(entry.id)?.mark === 'known',
        }));
      return {
        collection,
        entries: shown,
        known: shown.filter(({ known }) => known).length,
        total: shown.length,
        added: isAdded(collectionId),
      };
    },
    async add(collectionId) {
      const collection = published(collectionId);
      if (collection === undefined || isAdded(collectionId) || adding.has(collectionId))
        return undefined;
      adding.add(collectionId);
      try {
        const live = await liveEntries(collection);
        return await collections.createCopy(
          collection.name,
          live.map(({ id }) => id),
          collectionId,
        );
      } finally {
        adding.delete(collectionId);
      }
    },
  };
}
