import type { EntryRowModel, EntryRows } from './entry-row';
import { createInTurn, createSubscribers, newestFirst } from './in-turn';
import type { Clock, Random, UserStateChanges } from './ports';
import type { UserState } from './user-state';
import { userStateRecords } from './user-state-schema';

/** A Collection, as the sheet and the Collections screens draw it. */
export interface Collection {
  readonly id: string;
  /** The name the user gave it, trimmed. */
  readonly name: string;
  /** When the user created it. */
  readonly createdAt: Date;
  /** How many Entries are in it. */
  readonly count: number;
  /**
   * What the rows of its newest Entries lead with, newest first: the Lemma of a
   * Word, and for a Correction the standard equivalent.
   */
  readonly newestLemmas: readonly string[];
}

/** Why a name is refused, for the UI to say in the Edition's words. */
export type CollectionNameRefusal =
  /** Nothing is left of the name once it is trimmed. */
  | 'empty'
  /** More than 40 characters are left. */
  | 'too-long'
  /** Another Collection already has the name, in any letter case. */
  | 'duplicate';

export type CollectionResult =
  | { readonly ok: true; readonly collection: Collection }
  | { readonly ok: false; readonly reason: CollectionNameRefusal };

/** An Entry in a Collection, as the Collection's screen draws it. */
export interface CollectionEntry {
  readonly entryId: string;
  /** When the user added it to the Collection. */
  readonly addedAt: Date;
  /** What its row in a list shows. */
  readonly row: EntryRowModel;
}

/**
 * Collections: the groups of Entries the user created and named, with an Entry
 * in as many as the user likes. They keep any Entry the Language Pack has,
 * Retired or not, and are read from the user state once, when they open, like
 * Favorites, so open one per app session (the Core composition does). A change
 * is made in memory only once it is written.
 */
export interface Collections {
  /**
   * The Collections, newest first. A change never edits this array: it makes a
   * new one and tells the subscribers, so the array stays the same until
   * something changes. A Collection that a change did not touch keeps its
   * object.
   */
  readonly list: readonly Collection[];
  /** The Collections the Entry is in, newest first; the same array until a change. */
  of(entryId: string): readonly Collection[];
  /**
   * The Entries in the Collection, newest first, Retired ones too; nothing for
   * a Collection that doesn't exist. The same array until that Collection
   * changes.
   */
  entries(collectionId: string): readonly CollectionEntry[];
  /** Whether the Entry is in the Collection. */
  has(collectionId: string, entryId: string): boolean;
  /**
   * Creates a Collection, as of now, with the Entry already in it when one is
   * given (skipped when the Language Pack doesn't have it). The name is refused with a reason when it breaks the name rules,
   * and nothing is kept.
   */
  create(name: string, entryId?: string): Promise<CollectionResult>;
  /**
   * Gives the Collection a new name, by the same rules as `create`; its own
   * name, in any letter case, is not a duplicate. The time it was created, its
   * Entries and its place in the list stay. Nothing for a Collection that
   * doesn't exist.
   */
  rename(collectionId: string, name: string): Promise<CollectionResult | undefined>;
  /**
   * Deletes the Collection, its record and the records of its Entries in one
   * write. The Entries stay wherever else they are kept (Favorites, History,
   * other Collections). A Collection that doesn't exist is skipped.
   */
  delete(collectionId: string): Promise<void>;
  /**
   * Adds the Entry to the Collection, as of now. An Entry already in it keeps
   * the time it was added; an Entry the Language Pack doesn't have, and a
   * Collection that doesn't exist, are skipped.
   */
  add(collectionId: string, entryId: string): Promise<void>;
  /** Takes the Entry out of the Collection. */
  remove(collectionId: string, entryId: string): Promise<void>;
  /** Calls `listener` after each change of the list. Returns the call that stops it. */
  subscribe(listener: () => void): () => void;
}

const { collections: collectionRecords, collectionEntries: collectionEntryRecords } =
  userStateRecords;

/** The longest name a Collection may have, in characters. */
const NAME_MAX_LENGTH = 40;
/** How many Lemmas a Collection shows of its newest Entries. */
const NEWEST_LEMMAS = 3;
const ID_ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';
const ID_LENGTH = 8;
const ID_ATTEMPTS = 5;

/** An Entry in a Collection. */
interface Filed {
  readonly addedAt: Date;
  readonly row: EntryRowModel;
}

interface Stored {
  readonly id: string;
  readonly name: string;
  readonly createdAt: Date;
  readonly filed: ReadonlyMap<string, Filed>;
}

const NONE: readonly Collection[] = [];
const NO_ENTRIES: readonly CollectionEntry[] = [];

const newestCollection = newestFirst<Collection>(
  (collection) => collection.createdAt,
  (collection) => collection.id,
);

const newestEntry = newestFirst<Filed>(
  (item) => item.addedAt,
  (item) => item.row.entryId,
);

function viewOf({ id, name, createdAt, filed }: Stored): Collection {
  const newest = [...filed.values()].sort(newestEntry);
  return {
    id,
    name,
    createdAt,
    count: filed.size,
    newestLemmas: newest.slice(0, NEWEST_LEMMAS).map((item) => item.row.title),
  };
}

/** The record of an Entry in a Collection: its id is the Collection id, a `.` and the Entry id. */
const entryRecord = (collectionId: string, entryId: string) =>
  collectionEntryRecords.record(`${collectionId}.${entryId}`);

/** The key of a name for comparing: one Unicode form in one letter case. */
const nameKey = (name: string) => name.normalize('NFC').toLowerCase();

/** Opens Collections over the user state, for the Core composition. */
export async function openCollections({
  rows,
  userState,
  clock,
  random,
}: {
  rows: EntryRows;
  userState: UserState;
  clock: Clock;
  random: Random;
}): Promise<Collections> {
  const [storedCollections, storedEntries] = await Promise.all([
    userState.list(collectionRecords),
    userState.list(collectionEntryRecords),
  ]);
  const filedByCollection = new Map<string, Map<string, Filed>>();
  await Promise.all(
    [...storedEntries].map(async ([id, added]) => {
      // Neither id holds a `.`, so the first one splits them.
      const dot = id.indexOf('.');
      const collectionId = id.slice(0, dot);
      const entryId = id.slice(dot + 1);
      if (dot < 0 || !storedCollections.has(collectionId)) return;
      const row = await rows.row(entryId);
      if (row === undefined) return;
      const filed = filedByCollection.get(collectionId) ?? new Map<string, Filed>();
      filed.set(entryId, { addedAt: new Date(added), row });
      filedByCollection.set(collectionId, filed);
    }),
  );
  const collections = new Map<string, Stored>();
  const views = new Map<string, Collection>();
  for (const [id, { name, createdAt }] of storedCollections) {
    const stored = {
      id,
      name,
      createdAt: new Date(createdAt),
      filed: filedByCollection.get(id) ?? new Map<string, Filed>(),
    };
    collections.set(id, stored);
    views.set(id, viewOf(stored));
  }

  let list: readonly Collection[] = NONE;
  /** The Entries of each Collection, made when asked for and dropped when that Collection changes. */
  const entriesOf = new Map<string, readonly CollectionEntry[]>();
  let byEntry = new Map<string, readonly Collection[]>();
  const subscribers = createSubscribers();

  /** Makes the list and the Collections of each Entry again from the views, newest first. */
  function remake(): void {
    list = [...views.values()].sort(newestCollection);
    byEntry = new Map();
    for (const collection of list) {
      for (const entryId of collections.get(collection.id)?.filed.keys() ?? []) {
        byEntry.set(entryId, [...(byEntry.get(entryId) ?? NONE), collection]);
      }
    }
  }
  remake();

  /** Keeps the changed Collection in memory and tells the subscribers. Returns its new view. */
  function change(stored: Stored): Collection {
    const view = viewOf(stored);
    collections.set(stored.id, stored);
    views.set(stored.id, view);
    entriesOf.delete(stored.id);
    remake();
    subscribers.tell();
    return view;
  }

  function entries(collectionId: string): readonly CollectionEntry[] {
    const collection = collections.get(collectionId);
    if (collection === undefined) return NO_ENTRIES;
    let made = entriesOf.get(collectionId);
    if (made === undefined) {
      made = [...collection.filed.values()]
        .sort(newestEntry)
        .map(({ addedAt, row }) => ({ entryId: row.entryId, addedAt, row }));
      entriesOf.set(collectionId, made);
    }
    return made;
  }

  const has = (collectionId: string, entryId: string) =>
    collections.get(collectionId)?.filed.has(entryId) ?? false;

  /** Why the name is refused for the Collection (a new one, or the one of `ownId`), if it is. */
  function refusalOf(name: string, ownId?: string): CollectionNameRefusal | undefined {
    if (name === '') return 'empty';
    // Count characters, not UTF-16 code units.
    if (Array.from(name).length > NAME_MAX_LENGTH) return 'too-long';
    const key = nameKey(name);
    return list.some((collection) => collection.id !== ownId && nameKey(collection.name) === key)
      ? 'duplicate'
      : undefined;
  }

  function newId(): string {
    for (let attempt = 0; attempt < ID_ATTEMPTS; attempt += 1) {
      const id = `k_${Array.from(
        { length: ID_LENGTH },
        () => ID_ALPHABET[Math.floor(random.next() * ID_ALPHABET.length)],
      ).join('')}`;
      if (!collections.has(id)) return id;
    }
    throw new Error('The random port gave no free Collection id.');
  }

  async function create(untrimmed: string, entryId?: string): Promise<CollectionResult> {
    const name = untrimmed.trim();
    const reason = refusalOf(name);
    if (reason !== undefined) return { ok: false, reason };
    const id = newId();
    const createdAt = clock.now();
    const row = entryId === undefined ? undefined : await rows.row(entryId);
    const changes = new Map<string, string | undefined>(
      collectionRecords.record(id).change({ name, createdAt: createdAt.toISOString() }),
    );
    const filed = new Map<string, Filed>();
    if (row !== undefined) {
      filed.set(row.entryId, { addedAt: createdAt, row });
      mergeInto(changes, entryRecord(id, row.entryId).change(createdAt.toISOString()));
    }
    await userState.write(changes);
    return { ok: true, collection: change({ id, name, createdAt, filed }) };
  }

  async function rename(
    collectionId: string,
    untrimmed: string,
  ): Promise<CollectionResult | undefined> {
    const collection = collections.get(collectionId);
    if (collection === undefined) return undefined;
    const name = untrimmed.trim();
    const reason = refusalOf(name, collectionId);
    if (reason !== undefined) return { ok: false, reason };
    // Keeping the name as it is changes nothing.
    const view = views.get(collectionId);
    if (name === collection.name && view !== undefined) return { ok: true, collection: view };
    await userState.write(
      collectionRecords
        .record(collectionId)
        .change({ name, createdAt: collection.createdAt.toISOString() }),
    );
    return { ok: true, collection: change({ ...collection, name }) };
  }

  async function deleteCollection(collectionId: string): Promise<void> {
    if (!collections.has(collectionId)) return;
    // Every record of its Entries, also one of an Entry the Language Pack no longer has.
    const prefix = `${collectionId}.`;
    const changes = new Map<string, string | undefined>(
      collectionRecords.record(collectionId).change(undefined),
    );
    for (const key of (await userState.list(collectionEntryRecords)).keys()) {
      if (key.startsWith(prefix)) {
        mergeInto(changes, collectionEntryRecords.record(key).change(undefined));
      }
    }
    await userState.write(changes);
    collections.delete(collectionId);
    views.delete(collectionId);
    entriesOf.delete(collectionId);
    remake();
    subscribers.tell();
  }

  async function add(collectionId: string, entryId: string): Promise<void> {
    const collection = collections.get(collectionId);
    if (collection === undefined || collection.filed.has(entryId)) return;
    const row = await rows.row(entryId);
    if (row === undefined) return;
    const addedAt = clock.now();
    await userState.write(entryRecord(collectionId, entryId).change(addedAt.toISOString()));
    change({ ...collection, filed: new Map([...collection.filed, [entryId, { addedAt, row }]]) });
  }

  async function remove(collectionId: string, entryId: string): Promise<void> {
    const collection = collections.get(collectionId);
    if (collection?.filed.has(entryId) !== true) return;
    await userState.write(entryRecord(collectionId, entryId).change(undefined));
    const filed = new Map(collection.filed);
    filed.delete(entryId);
    change({ ...collection, filed });
  }

  const inTurn = createInTurn();

  return {
    get list() {
      return list;
    },
    of: (entryId) => byEntry.get(entryId) ?? NONE,
    entries,
    has,
    create: (name, entryId) => inTurn(() => create(name, entryId)),
    rename: (collectionId, name) => inTurn(() => rename(collectionId, name)),
    delete: (collectionId) => inTurn(() => deleteCollection(collectionId)),
    add: (collectionId, entryId) => inTurn(() => add(collectionId, entryId)),
    remove: (collectionId, entryId) => inTurn(() => remove(collectionId, entryId)),
    subscribe: subscribers.subscribe,
  };
}

function mergeInto(target: Map<string, string | undefined>, changes: UserStateChanges): void {
  for (const [key, value] of changes) target.set(key, value);
}
