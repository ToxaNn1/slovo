/**
 * The ports of the server Core: what its modules need from the world, which
 * the backend's adapters give. Modules take them in an object of dependencies,
 * so a test gives its own.
 */
import type { PackMetadata, PublishedPack } from '@slovo/contracts';

/** The current time, injected so the rules that read it stay testable. */
export interface Clock {
  now(): Date;
}

export const systemClock: Clock = { now: () => new Date() };

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
  | { readonly ok: true; readonly token: string; readonly account: AccountRecord }
  /** The code is not the one last sent to the email; `triesLeft` more may be tried. */
  | { readonly ok: false; readonly reason: 'wrong-code'; readonly triesLeft: number }
  /** No code is waiting for the email: it ran out of time, or none was sent. */
  | { readonly ok: false; readonly reason: 'code-expired' }
  /** Every try of the code is spent. */
  | { readonly ok: false; readonly reason: 'too-many-tries' };

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
  /** The Account of the Session the token carries, if the Session is on. Using a Session extends it. */
  accountOf(token: string): Promise<AccountRecord | undefined>;
  /** Ends the Session the token carries, if it is on. */
  revoke(token: string): Promise<void>;
  /** Ends every Session of the Account. */
  revokeAll(accountId: string): Promise<void>;
  /**
   * Deletes the Account with its Sessions and sign-in methods, and the
   * Sign-in codes waiting for its email, all at once.
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

/**
 * Counts requests under a key in windows of time, one key at a time (Postgres
 * in the backend). A key's window opens with its first request after the
 * last window ended, and lasts as long as the request asks.
 */
export interface RateLimits {
  /**
   * Counts one request under the key at `now`, and answers how many requests
   * its window holds, this one included, and when the window ends.
   */
  count(
    key: string,
    windowSeconds: number,
    now: Date,
  ): Promise<{ readonly count: number; readonly windowEnds: Date }>;
}
