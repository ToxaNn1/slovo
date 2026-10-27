import type { Category, Entry, PackMetadata, PublishedPack, Word } from '@slovo/contracts';

/**
 * Reads a compiled Language Pack. Each platform supplies an adapter (Node for
 * tests and tooling, expo-sqlite in the mobile shell); the Core only sees this.
 */
export interface ContentReadPort {
  /**
   * Every Category of the pack, with its display name, in the pack's order
   * (the order the Edition declares them in), also one whose Words are all Retired. The pack is the runtime source of
   * Categories, so a content update may add one (ADR 0033).
   */
  listCategories(): Promise<readonly Category[]>;
  /**
   * Every Category of Corrections of the pack, a list apart from the Words'
   * (ADR 0050), with its display name, in the pack's order, also one whose
   * Corrections are all Retired.
   */
  listCorrectionCategories(): Promise<readonly Category[]>;
  /**
   * The ids of the Words that are not retired, in a stable order; only those
   * of the Category when one is given. A Retired Word is left out, so nothing
   * new picks it.
   */
  listWordIds(categoryId?: string): Promise<readonly string[]>;
  /**
   * Every Word that is not retired, in the order of `listWordIds`, read at
   * once, for a feature that needs them all, such as the Game's Distractors.
   */
  listWords(): Promise<readonly Word[]>;
  /**
   * The Entries of the ids, whatever their kind, read at once, in no set
   * order: a Retired Entry included, so kept Entries stay reachable, and an
   * id the pack has no Entry for left out. The pack records each id's kind of
   * Entry, so one call reads each kind once.
   */
  getEntries(ids: readonly string[]): Promise<readonly Entry[]>;
  /**
   * The ids of the Corrections that are not retired, in a stable order. A
   * Retired Correction is left out, so nothing new picks it.
   */
  listCorrectionIds(): Promise<readonly string[]>;
  /**
   * The ids of the Words that are not retired and are the standard form for
   * the Correction, in a stable order.
   */
  listLinkedWordIds(correctionId: string): Promise<readonly string[]>;
  /**
   * The ids of the Idioms that are not retired, in a stable order. A Retired
   * Idiom is left out, so nothing new picks it.
   */
  listIdiomIds(): Promise<readonly string[]>;
  /**
   * The ids of the Synonym Rows that are not retired and link the Word as a
   * member while the Word is not retired, in a stable order. A row that names
   * the Word only as its dominant, or only as plain text, doesn't link it.
   */
  listLinkingSynonymRowIds(wordId: string): Promise<readonly string[]>;
  /**
   * The ids of the Synonym Rows that are not retired, in a stable order. A
   * Retired Synonym Row is left out, so nothing new picks it.
   */
  listSynonymRowIds(): Promise<readonly string[]>;
  /**
   * The ids of the Tips that are not retired, in a stable order. A Retired
   * Tip is left out, so nothing new picks it.
   */
  listTipIds(): Promise<readonly string[]>;
}

/**
 * Changes to the user state, by key: a value replaces the record, `undefined`
 * deletes it.
 */
export type UserStateChanges = ReadonlyMap<string, string | undefined>;

/**
 * Keeps the user's state on the device as text records by key, in a writable
 * store apart from the read-only Language Pack. Each platform supplies an
 * adapter (in memory for tests, expo-sqlite in the mobile shell); the Core
 * owns the keys, the values and the schema version.
 */
export interface UserStatePort {
  /** The record stored under the key, if any. */
  get(key: string): Promise<string | undefined>;
  /**
   * Every record whose key starts with the prefix, by key, in no set order.
   * The prefix is matched as it is: case counts, and no character is a
   * wildcard.
   */
  list(prefix: string): Promise<ReadonlyMap<string, string>>;
  /** Applies every change at once, or none of them. */
  write(changes: UserStateChanges): Promise<void>;
}

/**
 * The source of the current time and the device's time zone, injected so
 * behaviour stays testable. Local calendar days follow the time zone.
 */
export interface Clock {
  now(): Date;
  /** The IANA name of the current time zone, such as `Europe/Kyiv`. */
  timeZone(): string;
}

/** A source of random numbers in [0, 1), injected so behaviour stays testable. */
export interface Random {
  next(): number;
}

/**
 * Runs something after a delay, in milliseconds, and returns the way to
 * cancel it. The shell gives the real clock; a test gives its own.
 */
export type Schedule = (run: () => void, delay: number) => () => void;

/**
 * A request to the backend that failed as any request may: no answer
 * (`offline`), a server error (5xx), too many requests (429), or an answer the
 * request never expects (`unexpected`), such as a request the backend refuses
 * (400) or an Edition it doesn't serve (404). The first two may pass by
 * themselves, and they alone are tried again (ADR 0037).
 */
export interface RequestFailure {
  readonly ok: false;
  readonly reason: 'offline' | 'server-error' | 'too-many-requests' | 'unexpected';
}

/** Whether the device lets the app notify: the reader allowed it, denied it, or hasn't been asked yet. */
export type NotificationPermission = 'allowed' | 'denied' | 'not-asked';

/**
 * The sound a notification plays: the Edition's own, named by the file the
 * shell bundles, the system default when the Edition has none, or none at all
 * when the reader switched it off.
 */
export type PlannedSound = { readonly file: string } | 'system' | 'silent';

/**
 * One notification of the plan: a Word at a local date and time, floating
 * (ADR 0021). It has no time zone: it comes at that wall-clock time in
 * whatever time zone the device is in when it is due.
 */
export interface PlannedNotification {
  /** The local date, `YYYY-MM-DD`. */
  readonly date: string;
  /** The local time, `HH:MM` on a 24-hour clock. */
  readonly time: string;
  /** The Lemma with its Stress marks; empty for the farewell, under which the device shows the app's name. */
  readonly title: string;
  /** The primary Definition, cut short at a word boundary, or the Edition's farewell. */
  readonly body: string;
  /** The Word it carries, which a tap opens; the farewell carries none (ADR 0054). */
  readonly wordId?: string;
  readonly sound: PlannedSound;
}

/**
 * Schedules the Core's notification plan on the device. The Core plans; the
 * shell implements this port on the platform's notifications (ADR 0021).
 */
export interface NotificationSchedulerPort {
  /** Whether the device lets the app notify. */
  permission(): Promise<NotificationPermission>;
  /** Asks the reader for permission, when it isn't asked yet, and reports it. */
  askPermission(): Promise<NotificationPermission>;
  /**
   * Replaces every pending notification with the plan, so the device holds
   * exactly the Core's plan. An empty plan cancels them all.
   */
  replacePlan(plan: readonly PlannedNotification[]): Promise<void>;
}

/**
 * A call of the Account API that failed as any request does, or because the
 * Session it carried has ended (401).
 */
export type AccountApiFailure =
  RequestFailure | { readonly ok: false; readonly reason: 'unauthorized' };

/**
 * The backend's Account procedures, as the Core sees them. The shell
 * implements this port on the API contract's client, which also names the
 * Edition whose language the Sign-in code email is in. The calls that act on
 * an Account carry the token of its Session. A call never rejects: every
 * answer of the backend comes back as success or a failure.
 */
export interface AccountApi {
  /**
   * Sends a Sign-in code to the email. The answer is the same whether or not
   * the email has an Account.
   */
  requestCode(email: string): Promise<{ readonly ok: true } | AccountApiFailure>;
  /**
   * Checks the code last sent to the email. The first right code creates the
   * Account; the answer is the new Session's token and the Account's email.
   */
  verifyCode(
    email: string,
    code: string,
  ): Promise<
    | { readonly ok: true; readonly token: string; readonly email: string }
    | { readonly ok: false; readonly reason: 'wrong-code'; readonly triesLeft: number }
    | { readonly ok: false; readonly reason: 'code-expired' }
    | AccountApiFailure
  >;
  /**
   * Signs in with a Google identity token. The first sign-in of an email
   * creates its Account, whatever Sign-in method (ADR 0047); the answer is the
   * new Session's token and the Account's email. The backend refuses a token
   * that is not Google's, has expired, is for another app or names an email
   * Google hasn't verified.
   */
  signInWithGoogle(
    idToken: string,
  ): Promise<
    | { readonly ok: true; readonly token: string; readonly email: string }
    | { readonly ok: false; readonly reason: 'refused' }
    | AccountApiFailure
  >;
  /** The email of the Session's Account. */
  me(token: string): Promise<{ readonly ok: true; readonly email: string } | AccountApiFailure>;
  /** Ends the Session. */
  signOut(token: string): Promise<{ readonly ok: true } | AccountApiFailure>;
  /** Ends every Session of the Session's Account. */
  signOutEverywhere(token: string): Promise<{ readonly ok: true } | AccountApiFailure>;
  /** Deletes the Session's Account with every Session of it, for good. */
  delete(token: string): Promise<{ readonly ok: true } | AccountApiFailure>;
}

/**
 * Google's native sign-in sheet, as the Core sees it (ADR 0047): the shell
 * implements this port on Google's SDK. The sheet never rejects: the reader
 * signs in, dismisses it, or it fails.
 */
export interface GoogleSignInSheet {
  /**
   * Shows the sheet and answers the Google identity token of the reader who
   * signed in, that the reader cancelled, or that it found no network or
   * failed otherwise.
   */
  signIn(): Promise<
    | { readonly ok: true; readonly idToken: string }
    | { readonly ok: false; readonly reason: 'cancelled' | 'offline' | 'unexpected' }
  >;
  /**
   * Forgets the Google sign-in this device keeps, once its Session has ended,
   * and with `revoke` also takes back the reader's grant to the app, as when
   * the Account is deleted. The Account goes on whether or not it succeeds.
   */
  forget(options: { readonly revoke: boolean }): Promise<void>;
}

/** A JSON value, as the value of a record travels to the backend and back. */
export type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

/**
 * One change of a record of the user state, as Sync pushes it and a pull
 * answers it (ADR 0041): the record's key, its value, or `null` for a
 * deletion (a tombstone), and when the Core wrote it, in milliseconds since
 * 1970-01-01 UTC by the device's clock; 0 is older than any change.
 */
export interface RecordChange {
  readonly key: string;
  readonly value: Json;
  readonly changedAt: number;
}

/**
 * A call of the Sync API that failed as any request does, because the
 * Session it carried has ended (401), because the backend serves no Sync
 * for the Edition (404), or because a push would take the Account's records
 * in the Edition over their limit (409, `TOO_MANY_RECORDS`). Too many
 * requests (429) carries the answer's `Retry-After`.
 */
export type SyncApiFailure =
  | { readonly ok: false; readonly reason: Exclude<RequestFailure['reason'], 'too-many-requests'> }
  | {
      readonly ok: false;
      readonly reason: 'too-many-requests';
      /** How long to wait before the next Sync request, in seconds; none when the answer didn't say. */
      readonly retryAfter: number | undefined;
    }
  | { readonly ok: false; readonly reason: 'unauthorized' }
  | { readonly ok: false; readonly reason: 'not-found' }
  | { readonly ok: false; readonly reason: 'too-many-records' };

/**
 * The backend's Sync procedures for the running Edition, as the Core sees
 * them, on the Account of the Session whose token each call carries. The
 * shell implements this port on the API contract's client. A call never
 * rejects: every answer of the backend comes back as success or a failure.
 */
export interface SyncApi {
  /**
   * Keeps the changes, at most `SYNC_BATCH_SIZE`: each replaces the record
   * kept under its key only when it is later (ADR 0041).
   */
  push(
    token: string,
    changes: readonly RecordChange[],
  ): Promise<{ readonly ok: true } | SyncApiFailure>;
  /**
   * One page of the records kept after the cursor, from the first without
   * one, in the order the backend kept them: at most `SYNC_BATCH_SIZE`, the
   * cursor to ask after next, and whether more follow.
   */
  pull(
    token: string,
    after: number | undefined,
  ): Promise<
    | {
        readonly ok: true;
        readonly records: readonly RecordChange[];
        readonly cursor: number;
        readonly more: boolean;
      }
    | SyncApiFailure
  >;
}

/** This device's Session as the device keeps it: its token and the email of its Account. */
export interface KeptSession {
  readonly token: string;
  readonly email: string;
}

/**
 * Keeps this device's Session: in the Keychain in the mobile shell, in memory
 * in tests and on a development client without the Keychain module. Never in
 * the user state or in a file.
 */
export interface SessionStore {
  /** Keeps the Session, in place of any kept before. */
  keep(session: KeptSession): Promise<void>;
  /** The Session kept, if any. */
  read(): Promise<KeptSession | undefined>;
  /** Forgets the Session kept, if any. */
  forget(): Promise<void>;
}

export const systemClock: Clock = {
  now: () => new Date(),
  timeZone: () => Intl.DateTimeFormat().resolvedOptions().timeZone,
};

export const systemRandom: Random = { next: () => Math.random() };

/**
 * Which Language Pack it is: its content version (ADR 0011) and its pack
 * format, as the pack's metadata records them.
 */
export type PackVersion = Readonly<Pick<PackMetadata, 'contentVersion' | 'packFormat'>>;

/** A call of the content API that failed as any request does, or found no such Edition or pack (404). */
export type ContentApiFailure =
  RequestFailure | { readonly ok: false; readonly reason: 'not-found' };

/**
 * The backend's content procedures for the running Edition, as the Core sees
 * them. They need no Account. The shell implements this port on the API
 * contract's client. A call never rejects: every answer of the backend comes
 * back as success or a failure.
 */
export interface ContentApi {
  /** The newest published pack of the pack format; none when nothing of it is published. */
  latest(
    packFormat: number,
  ): Promise<{ readonly ok: true; readonly pack: PublishedPack | undefined } | ContentApiFailure>;
  /** The bytes of the pack file of the content version. */
  download(
    contentVersion: number,
  ): Promise<{ readonly ok: true; readonly bytes: Uint8Array } | ContentApiFailure>;
}

/**
 * Keeps one downloaded Language Pack on the device, apart from the pack
 * bundled with the app, for the shell to open at the next launch.
 */
export interface PackFiles {
  /** Keeps the pack file with its version, in place of any pack kept before. */
  keep(version: PackVersion, bytes: Uint8Array): Promise<void>;
  /** The version of the pack kept, if one is. */
  read(): Promise<PackVersion | undefined>;
  /** Throws the kept pack away, if one is kept. */
  forget(): Promise<void>;
}

/**
 * What the backend answers for the running Edition's remote Feature Switches:
 * the features the owner turned off remotely, by their Feature Switch's name,
 * and the ETag that names them (ADR 0040).
 */
export interface RemoteSwitchesAnswer {
  readonly off: readonly string[];
  readonly etag: string;
}

/**
 * The backend's `edition.switches` procedure for the running Edition, as the
 * Core sees it. It needs no Account. The shell implements this port on the
 * API contract's client. A call never rejects: every answer of the backend
 * comes back as success or a failure.
 */
export interface SwitchesApi {
  /**
   * The remote Feature Switches, or `unchanged` when `etag`, the ETag of the
   * answer the app keeps, still names them.
   */
  switches(
    etag: string | undefined,
  ): Promise<
    { readonly ok: true; readonly answer: RemoteSwitchesAnswer | 'unchanged' } | RequestFailure
  >;
}
