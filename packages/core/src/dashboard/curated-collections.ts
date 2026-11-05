import type { CuratedCollection } from '@slovo/contracts';

import type { Edition } from '../edition/edition';
import { createSubscribers } from '../in-turn';
import { todayKey, type LocalDate } from '../local-date';
import type { Clock, ContentReadPort } from '../ports';
import type { UserState } from '../user-state/user-state';
import { dashboardRecords } from './records';

/** The rail shows this many cards at most. */
const RAIL_LENGTH = 10;

/** One card of the Curated Collections rail: «Нова» until the reader opens it. */
export interface CuratedCollectionCard {
  readonly collection: CuratedCollection;
  readonly state: 'new' | 'opened';
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
  /** Calls `listener` after each change of the rail. Returns the call that stops it. */
  subscribe(listener: () => void): () => void;
  /** Marks the collection opened, once; the rail follows. An unknown id changes nothing. */
  open(collectionId: string): Promise<void>;
}

export async function openCuratedCollections({
  edition,
  content,
  userState,
  clock,
  dayTurned,
}: {
  edition: Pick<Edition, 'isFeatureEnabled'>;
  content: Pick<ContentReadPort, 'listCuratedCollections'>;
  userState: Pick<UserState, 'list' | 'write'>;
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

  async function railOf(): Promise<readonly CuratedCollectionCard[]> {
    const today = todayKey(clock);
    const opened = await openedIds();
    return all
      .filter(({ publishedOn }) => publishedOn <= today)
      .map((collection): CuratedCollectionCard => ({
        collection,
        state: opened.has(collection.id) ? 'opened' : 'new',
      }))
      .sort(
        (one, other) =>
          Number(one.state === 'opened') - Number(other.state === 'opened') ||
          other.collection.publishedOn.localeCompare(one.collection.publishedOn) ||
          one.collection.id.localeCompare(other.collection.id),
      )
      .slice(0, RAIL_LENGTH);
  }

  let rail = await railOf();
  async function refresh(): Promise<void> {
    rail = await railOf();
    subscribers.tell();
  }
  if (on) dayTurned.subscribe(() => refresh());

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
  };
}
