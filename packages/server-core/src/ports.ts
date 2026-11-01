/**
 * The ports of the server Core: what its modules need from the world, which
 * the backend's adapters give. Modules take them in an object of dependencies,
 * so a test gives its own.
 */
import type {
  CollectionLink,
  CounterEvent,
  MistakeReport,
  PackMetadata,
  PublishedPack,
  QuestionnaireQuestion,
} from '@slovo/contracts';

/** The current time, injected so the rules that read it stay testable. */
export interface Clock {
  now(): Date;
}

export const systemClock: Clock = { now: () => new Date() };

/** Randomness, injected so the rules that draw on it stay testable. */
export interface Random {
  /** A whole number from 0 up to, not including, `bound`. */
  int(bound: number): number;
}

/** The published Language Packs of every Edition, kept by the backend. */
export interface ContentPackStore {
  /** The newest published pack of the Edition in the pack format, if any. */
  latest(editionId: string, packFormat: number): Promise<PublishedPack | undefined>;
  /** The file of the Edition's pack published at the content version, if one is. */
  file(editionId: string, contentVersion: number): Promise<PublishedFile | undefined>;
  /**
   * Keeps the pack unless `refuse`, given every content version published
   * for its Edition, names why not, and answers that reason. The check and
   * the insert run in one transaction, and no other publishing of the
   * Edition comes between them. A kept pack is never updated.
   */
  publish<Refusal>(
    pack: ContentPack,
    refuse: (publishedVersions: readonly number[]) => Refusal | undefined,
  ): Promise<Refusal | undefined>;
}

/** A built Language Pack file: the bytes, the metadata recorded in them and their SHA-256. */
export interface PackFile {
  readonly metadata: PackMetadata;
  /** The SHA-256 of the file, as 64 lowercase hex digits; not the content checksum. */
  readonly fileSha256: string;
  readonly bytes: Uint8Array;
}

/** The bytes of a published pack file and their SHA-256, as a download serves them. */
export type PublishedFile = Pick<PackFile, 'fileSha256' | 'bytes'>;

/** A Language Pack file as it is published. */
export interface ContentPack extends PackFile {
  readonly publishedAt: Date;
}

/** An Account as the server Core sees it. */
export interface AccountRecord {
  readonly id: string;
  /** Trimmed and lower-cased. */
  readonly email: string;
  readonly createdAt: Date;
}

/** What checking a Sign-in code gives the Authenticator. */
export type CodeCheck =
  | ({ readonly ok: true } & SignedIn)
  /** The code is not the one last sent to the email; `triesLeft` more may be tried. */
  | { readonly ok: false; readonly reason: 'wrong-code'; readonly triesLeft: number }
  /** No code is waiting for the email: it ran out of time, or none was sent. */
  | { readonly ok: false; readonly reason: 'code-expired' }
  /** Every try of the code is spent. */
  | { readonly ok: false; readonly reason: 'too-many-tries' };

/** Who a Google identity token names, as Google verified it. */
export interface GoogleIdentity {
  /** Google's own id of the person, which never changes; the email may. */
  readonly subject: string;
  /** The email as the token carries it. */
  readonly email: string;
  /** Whether Google has verified that the person owns the email. */
  readonly emailVerified: boolean;
}

/** What verifying a Google identity token gives. */
export type GoogleTokenCheck =
  | { readonly ok: true; readonly identity: GoogleIdentity }
  /** The backend has no Google client id, so no token can be for it. */
  | { readonly ok: false; readonly reason: 'not-configured' }
  /** The token is not a Google identity token, its signature doesn't check, or it has expired. */
  | { readonly ok: false; readonly reason: 'invalid-token' }
  /** The token was issued to an app that is not SLOVO: its audience is none of the client ids. */
  | { readonly ok: false; readonly reason: 'foreign-audience' };

/**
 * Verifies Google identity tokens (`jose` with Google's kept keys in the
 * backend): the signature against Google's keys, the issuer, the expiry and
 * the audience against SLOVO's client ids, which come from the environment.
 */
export interface GoogleVerifier {
  verify(idToken: string): Promise<GoogleTokenCheck>;
}

/** Who an Apple identity token names, as Apple signed it. */
export interface AppleIdentity {
  /** Apple's own id of the person for SLOVO's apps, which never changes; the email may. */
  readonly subject: string;
  /** The email as the token carries it: the reader's own, or a private relay address (ADR 0047). */
  readonly email: string;
}

/** What verifying an Apple identity token gives. */
export type AppleTokenCheck =
  | { readonly ok: true; readonly identity: AppleIdentity }
  /** The token is not an Apple identity token, its signature doesn't check, or it has expired. */
  | { readonly ok: false; readonly reason: 'invalid-token' }
  /** The token was issued to an app that is not the Edition's: its audience is not the bundle id. */
  | { readonly ok: false; readonly reason: 'foreign-audience' };

/**
 * Verifies Apple identity tokens (`jose` with Apple's kept keys in the
 * backend): the signature against Apple's keys, the issuer, the expiry and
 * the audience against the Edition's bundle id, SLOVO's client id at Apple
 * (ADR 0047).
 */
export interface AppleVerifier {
  verify(idToken: string, bundleId: string): Promise<AppleTokenCheck>;
}

/** What a sign-in that proved its identity gives: a new Session of the Account. */
export interface SignedIn {
  readonly token: string;
  readonly account: AccountRecord;
}

/**
 * Signs readers in: keeps the Sign-in codes and the Sessions of the Accounts
 * (better-auth in the backend). Emails reach it trimmed and lower-cased. The
 * rules of both are its own (spec #333): how long a code signs in, how many
 * tries it has and that a spent code stays spent, and how long a Session lasts.
 */
export interface Authenticator {
  /**
   * Makes a new Sign-in code for the email, in place of any code made for it
   * before, and gives it back to be sent. It keeps only the code's hash.
   */
  createCode(email: string): Promise<string>;
  /**
   * Checks the code against the one last made for the email. The first right
   * code for an email creates its Account; a right code starts a Session.
   */
  checkCode(email: string, code: string): Promise<CodeCheck>;
  /**
   * Signs in the Account of the identity's email, creating it when the email
   * has none, and records the Google identity as a Sign-in method of the
   * Account once. The email is verified and normalised already.
   */
  signInWithGoogle(identity: GoogleIdentity): Promise<SignedIn>;
  /**
   * Signs in the Account of the identity's email, creating it when the email
   * has none, and records the Apple identity as a Sign-in method of the
   * Account once. The email is normalised already.
   */
  signInWithApple(identity: AppleIdentity): Promise<SignedIn>;
  /**
   * The Session the token carries, by its id, with its Account, if the
   * Session is on. Using a Session extends it.
   */
  sessionOf(
    token: string,
  ): Promise<{ readonly id: string; readonly account: AccountRecord } | undefined>;
  /** Ends the Session the token carries, if it is on. */
  revoke(token: string): Promise<void>;
  /** Ends every Session of the Account. */
  revokeAll(accountId: string): Promise<void>;
  /**
   * Deletes the Account with its Sessions, sign-in methods and the records
   * Sync keeps of it in every Edition, and the Sign-in codes waiting for its
   * email, all at once.
   */
  delete(account: AccountRecord): Promise<void>;
}

/** An email to one reader, in plain text. */
export interface Mail {
  readonly to: string;
  /** The sender's name, which the reader sees beside the sender's address. */
  readonly senderName: string;
  /** One line. */
  readonly subject: string;
  readonly text: string;
}

/** Sends emails (SMTP in the backend). */
export interface Mailer {
  send(mail: Mail): Promise<void>;
}

/** How many requests a window of time takes. */
export interface RequestLimit {
  readonly requests: number;
  readonly windowSeconds: number;
}

/**
 * Counts requests under a key in windows of time, one key at a time (Postgres
 * in the backend). A key's window opens with its first request after the
 * last window ended, and lasts as long as the limit asks.
 */
export interface RateLimits {
  /**
   * Takes a request under the key at `now` as `weight` requests, at most the
   * limit's, into its window when they fit in the limit, and answers whether
   * they did and when the window ends. A request that does not fit counts
   * nothing.
   */
  take(
    key: string,
    limit: RequestLimit,
    now: Date,
    weight: number,
  ): Promise<{ readonly taken: boolean; readonly windowEnds: Date }>;
}

/**
 * The Feature Switches the owner turned off remotely, per Edition and feature
 * (Postgres in the backend). It keeps a feature by its name and never reads
 * it: the server Core checks the names.
 */
export interface RemoteSwitchStore {
  /** The features turned off in the Edition, in no order. */
  off(editionId: string): Promise<readonly string[]>;
  /** Sets whether the feature is off in the Edition, as of `at`. */
  set(editionId: string, feature: string, off: boolean, at: Date): Promise<void>;
}

/** A Mistake Report as the backend keeps it: the report and its time of arrival, nothing else. */
export interface KeptReport extends MistakeReport {
  readonly receivedAt: Date;
}

/**
 * The Mistake Reports still to check, per Edition (Postgres in the backend).
 * It keeps no IP address, no device id and no Account (ADR 0056).
 */
export interface MistakeReportStore {
  keep(report: KeptReport): Promise<void>;
}

/**
 * A Collection Link as the backend keeps it: the Collection as it was shared
 * and the time it was made, nothing else (ADR 0058).
 */
export interface KeptCollectionLink extends CollectionLink {
  readonly createdAt: Date;
}

/**
 * The Collection Links of every Edition (Postgres in the backend), each under
 * its id. A link is never changed; it keeps no IP address, no device id and
 * no Account (ADR 0058).
 */
export interface CollectionLinkStore {
  /** Keeps the link under the id, unless the id is taken: then it keeps nothing and answers false. */
  keep(id: string, link: KeptCollectionLink): Promise<boolean>;
  /** The link kept under the id, if any. */
  find(id: string): Promise<KeptCollectionLink | undefined>;
}

/** A JSON value, as a record of the user state holds it. */
export type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

/** One change of a record of an Account's user state in an Edition, as Sync keeps it. */
export interface RecordChange {
  /** The record's key in the user state; the backend never reads it. */
  readonly key: string;
  /** The record's value, which the backend never reads; null for a tombstone. */
  readonly value: Json;
  /** When the device wrote the change. */
  readonly changedAt: Date;
}

/** A record as Sync keeps it: its last change and the sequence number it took. */
export interface KeptRecord extends RecordChange {
  readonly sequence: number;
}

/**
 * The records of every Account's user state, per Edition (Postgres in the
 * backend). It keeps them without reading their keys or values (ADR 0041).
 */
export interface UserRecords {
  /**
   * Keeps each change whose change time is later than the one of the record
   * kept under its key, or that has no record yet, all in one transaction.
   * A kept change takes the next value of one sequence, so it comes after
   * every record already kept, and a pull that read up to a sequence number
   * never misses a record kept below it. Each key comes once. An Account
   * deleted meanwhile keeps nothing.
   *
   * It keeps nothing and answers the refusal when `refuse`, given how many
   * records the Account would keep in the Edition with the changes, tombstones
   * included, names one. The count and the changes kept come in the same
   * transaction, and no other push of the Account comes between them.
   */
  push<Refusal>(
    accountId: string,
    editionId: string,
    changes: readonly RecordChange[],
    refuse: (records: number) => Refusal | undefined,
  ): Promise<Refusal | undefined>;
  /** At most `limit` records of the Account in the Edition kept after the sequence number, in sequence order. */
  after(
    accountId: string,
    editionId: string,
    sequence: number,
    limit: number,
  ): Promise<readonly KeptRecord[]>;
}

/**
 * The Community Counters of every Edition and Entry (Postgres in the
 * backend): known, unknown and saved, totals only, each never below zero, and
 * the Favorites adds of each ISO week. It keeps no per-reader rows, so nothing
 * links two changes to one reader (ADR 0060).
 */
export interface CounterStore {
  /**
   * Adds the events' deltas to their Entries' counts, and each saved +1 to
   * the Entry's adds of the week, all of them or none. The week is its Monday
   * (UTC) as `YYYY-MM-DD`.
   */
  add(editionId: string, events: readonly CounterEvent[], week: string): Promise<void>;
  /** The counts kept of those of the Entries ever counted, in any order. */
  read(editionId: string, entryIds: readonly string[]): Promise<readonly EntryCounts[]>;
  /**
   * The Entry with the most Favorites adds in the Edition's ISO week, by its
   * Monday as `YYYY-MM-DD`, the lower Entry id by code points winning a tie;
   * none when nobody added anything that week.
   */
  mostAdded(editionId: string, week: string): Promise<CommunityWord | undefined>;
  /** Adds one to the count of the answer to the Edition's questionnaire question (ADR 0068). */
  addAnswer(editionId: string, question: QuestionnaireQuestion, answer: string): Promise<void>;
}

/** The Community Word of a week: the Entry most added to Favorites, with its adds (ADR 0060). */
export interface CommunityWord {
  readonly entryId: string;
  readonly adds: number;
}

/** An Entry's Community Counters: the readers who know it, don't and saved it. */
export interface EntryCounts {
  readonly entryId: string;
  readonly known: number;
  readonly unknown: number;
  readonly saved: number;
}
