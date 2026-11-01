import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import { SYNC_BATCH_SIZE, type CollectionLink, type MistakeReport } from '@slovo/contracts';
import { createApiClient, PACK_MEDIA_TYPE, type ApiFetch } from '@slovo/contracts/api';
import { fileOf, refusal, serveApi, type ApiProcedures } from '@slovo/contracts/api/test-support';

import type {
  Backend,
  Clock,
  CommunityWordAnswer,
  CounterEvent,
  EntryCounters,
  Json,
  PackVersion,
  RequestFailure,
} from '../ports';
import { systemClock } from '../ports';
import { fakeAppleIdentityOf } from './fake-apple-sign-in-sheet';
import { fakeGoogleIdentityOf } from './fake-google-sign-in-sheet';

/** A procedure of the API contract by its name, `account.requestCode`. */
export type ProcedureName = {
  [
    Domain in keyof ApiProcedures
  ]-?: `${Domain}.${Extract<keyof NonNullable<ApiProcedures[Domain]>, string>}`;
}[keyof ApiProcedures];

/**
 * How a request to the fake backend fails: as any request may, or by an
 * error code of the contract: the Session has ended (`unauthorized`, 401),
 * the backend serves no such thing (`not-found`, 404), or a push would take
 * the Account's records over their limit (`too-many-records`, 409).
 */
export type FakeFailureReason =
  RequestFailure['reason'] | 'unauthorized' | 'not-found' | 'too-many-records';

/** A failure the fake backend answers next: to any request, or to the next request of `procedure`. */
export interface FakeFailure {
  readonly reason: FakeFailureReason;
  readonly procedure?: ProcedureName;
  /** With `too-many-requests`, the seconds of the answer's `Retry-After`; none without. */
  readonly retryAfter?: number;
}

/** How many tries a Sign-in code of the fake allows, as the backend's do. */
const CODE_TRIES = 5;

/** A Sign-in code the fake sent, as a test reads it from the mailbox. */
export interface SentCode {
  readonly email: string;
  readonly code: string;
}

/** A record as the fake backend keeps it: the change that won, and its sequence number. */
export interface KeptRecord {
  readonly value: Json;
  readonly changedAt: number;
  readonly sequence: number;
}

/** A pack the fake backend has published, with the bytes of its file. */
export interface FakePublishedPack extends PackVersion {
  readonly bytes: Uint8Array;
  /** The SHA-256 the backend announces; without it, that of the bytes. */
  readonly fileSha256?: string;
}

/**
 * A backend for tests: the API contract served in process (ADR 0064), its
 * procedures answering like the backend's over state held in memory, and
 * `backend`, the Core's Backend port over it (ADR 0064). The test reads and
 * sets the state by domain, and makes requests fail.
 */
export interface FakeBackend {
  /** The Backend port over this backend: the contract's client, its requests served in process. */
  readonly backend: Backend;
  /** The procedures called, by name, in order, the failed ones included. */
  readonly calls: readonly ProcedureName[];
  /** Whether the backend can be reached; while it can't, every request gets no answer (`offline`). */
  online: boolean;
  /**
   * Makes the next requests fail, one each, in the order given, before they
   * reach the state: a reason fails the next request whatever its procedure;
   * a failure naming a procedure waits for the next request of that one.
   */
  failNext(...failures: readonly (FakeFailureReason | FakeFailure)[]): void;
  /** Holds the next request until the call it returns lets it go on. */
  hold(): () => void;
  /**
   * The Account procedures: they send Sign-in codes `100001`, `100002` and so
   * on to a mailbox the test reads, each valid for 5 tries, a new code for an
   * email replacing the one before; take the identity tokens of the fake
   * Google and Apple sign-in sheets; create an Account on the first sign-in
   * of its email; and keep Sessions by token.
   */
  readonly account: {
    /** The Sign-in codes sent, oldest first. */
    readonly sentCodes: readonly SentCode[];
    /** The emails of the Accounts there are. */
    readonly accounts: readonly string[];
    /** The tokens of the Sessions there are. */
    readonly sessionTokens: readonly string[];
    /** Lets every Sign-in code sent so far expire. */
    expireCodes(): void;
    /** Ends every Session there is, as signing out everywhere on another device does. */
    endSessions(): void;
  };
  /**
   * The Sync procedures: one Account's records in one Edition, by the
   * backend's rules (ADR 0041): a change replaces the record kept under its
   * key only when it is later, a change time later than the clock's counts
   * as the clock's, and every kept change takes the next sequence number,
   * which a pull pages by. Every token is the Account's.
   */
  readonly sync: {
    /** The records kept, by key. */
    readonly records: ReadonlyMap<string, KeptRecord>;
  };
  /** The Mistake Report procedure (ADR 0056): it keeps the reports it takes. */
  readonly reports: {
    /** The reports the backend took, in order. */
    readonly received: readonly MistakeReport[];
  };
  /**
   * The Collection Link procedures (ADR 0058): a link gets the next id,
   * `link000001` on, and its URL on the link domain; it reads back as it was
   * stored, and an unknown id is not found.
   */
  readonly collectionLinks: {
    /** The links the backend made, in order. */
    readonly made: readonly CollectionLink[];
  };
  /** The content procedures: the test publishes packs, and `content.latest` announces the newest of a pack format. */
  readonly content: {
    /** The pack format of each `content.latest` request, in order, failed ones included. */
    readonly asked: readonly number[];
    /** The content version of each `content.download` request, in order, failed ones included. */
    readonly downloaded: readonly number[];
    /** Publishes a pack, which `content.latest` announces while it is the newest of its format. */
    publish(pack: FakePublishedPack): void;
  };
  /** The Community Counters procedures (ADR 0060): the counts the backend keeps, and what it counted. */
  readonly counters: {
    /** The Entry ids of each `counters.read` request, in order, failed ones included. */
    readonly asked: readonly (readonly string[])[];
    /** The events of each `counters.send` request the backend counted, in order. */
    readonly sent: readonly (readonly CounterEvent[])[];
    /** The input of each `counters.questionnaire` request the backend counted, in order. */
    readonly answers: readonly {
      readonly editionId: string;
      readonly question: string;
      readonly answer: string;
    }[];
    /** Sets the counts the backend keeps for an Entry; an Entry nobody counted answers zeros. */
    count(entryId: string, counts: Omit<EntryCounters, 'entryId'>): void;
    /** Answers this Community Word from now on; `undefined`, none, as when nobody added anything. */
    answerCommunityWord(communityWord: CommunityWordAnswer | undefined): void;
  };
  /**
   * The `edition.switches` procedure (ADR 0040): the features the owner
   * turned off remotely, with an ETag that names them, and 304 when the app
   * names that ETag.
   */
  readonly switches: {
    /** The ETag each `edition.switches` request named, in order, the failed ones included. */
    readonly asked: readonly (string | undefined)[];
    /** Sets the features turned off remotely, as `pnpm switch:off` and `switch:clear` do. */
    turnOff(...features: readonly string[]): void;
  };
}

/** What a request brings to a procedure served in process: its headers, where a Session travels, and the answer's. */
type ServedContext = Parameters<
  NonNullable<NonNullable<ApiProcedures['account']>['me']>
>[0]['context'];

/** What the fake knows of a request while it serves it: whether its answer is to be lost. */
interface ServedRequest {
  offline: boolean;
}

/** The fake backend's time is the clock's; its links are under each Edition's path on the domain. */
export function createFakeBackend({
  clock = systemClock,
  domain = 'links.example',
}: { clock?: Clock; domain?: string } = {}): FakeBackend {
  const calls: ProcedureName[] = [];
  const failures: FakeFailure[] = [];
  let held: Promise<void> | undefined;
  /** Each request under way, by the headers it came with, which its procedure sees as `context.headers`. */
  const served = new WeakMap<ServedContext['headers'], ServedRequest>();

  // The Account.
  const sentCodes: SentCode[] = [];
  const accounts = new Map<string, { readonly createdAt: string }>();
  /** The email of each Session, by token. */
  const sessions = new Map<string, string>();
  /** The live code of each email, with its tries left. */
  const codes = new Map<string, { code: string; triesLeft: number }>();
  let sessionCount = 0;
  // Sync.
  const records = new Map<string, KeptRecord>();
  let sequence = 0;
  // Mistake Reports, Collection Links, content, counters, switches.
  const received: MistakeReport[] = [];
  const made: CollectionLink[] = [];
  const linksById = new Map<string, CollectionLink>();
  const packs: FakePublishedPack[] = [];
  const packFormatsAsked: number[] = [];
  const downloaded: number[] = [];
  const counts = new Map<string, Omit<EntryCounters, 'entryId'>>();
  const countersAsked: (readonly string[])[] = [];
  const answers: {
    readonly editionId: string;
    readonly question: string;
    readonly answer: string;
  }[] = [];
  const sent: (readonly CounterEvent[])[] = [];
  let communityWord: CommunityWordAnswer | undefined;
  let off: string[] = [];
  const etagsAsked: (string | undefined)[] = [];

  const fake = {
    online: true,
  };

  /**
   * Logs the request, waits while it is held, and fails it when a failure is
   * due: no answer drops the answer on its way back, a server error is any
   * error the procedure throws, and the rest are errors of the contract.
   */
  async function arrive(name: ProcedureName, context: ServedContext): Promise<void> {
    calls.push(name);
    const holding = held;
    held = undefined;
    await holding;
    const at = failures.findIndex(({ procedure }) => procedure === undefined || procedure === name);
    const failure = at === -1 ? undefined : failures.splice(at, 1)[0];
    const reason = fake.online ? failure?.reason : 'offline';
    switch (reason) {
      case undefined:
        return;
      case 'offline': {
        const request = served.get(context.headers);
        if (request !== undefined) request.offline = true;
        throw new Error('The fake backend is out of reach');
      }
      case 'server-error':
        throw new Error('The fake backend failed');
      case 'too-many-requests':
        throw refusal(
          'TOO_MANY_REQUESTS',
          context,
          failure?.retryAfter === undefined ? {} : { retryAfter: failure.retryAfter },
        );
      case 'unexpected':
        throw refusal('BAD_REQUEST', context);
      case 'unauthorized':
        throw refusal('UNAUTHORIZED', context);
      case 'not-found':
        throw refusal('NOT_FOUND', context);
      case 'too-many-records':
        throw refusal('TOO_MANY_RECORDS', context);
    }
  }

  /** The email of the Session the request carries, or the contract's 401. */
  function sessionOf(context: ServedContext): string {
    const token = context.headers.get('authorization')?.replace(/^Bearer /, '');
    const email = token === undefined ? undefined : sessions.get(token);
    if (email === undefined) throw refusal('UNAUTHORIZED', context);
    return email;
  }

  /** Signs the email in: its Account, created at its first sign-in, gets a new Session. */
  function startSession(email: string) {
    if (!accounts.has(email)) accounts.set(email, { createdAt: clock.now().toISOString() });
    sessionCount += 1;
    const token = `session-${String(sessionCount)}`;
    sessions.set(token, email);
    return { token, email };
  }

  function endSessionsOf(email: string): void {
    for (const [token, owner] of sessions) if (owner === email) sessions.delete(token);
  }

  const etagOf = (names: readonly string[]) => `"${names.join(',')}"`;

  const procedures: ApiProcedures = {
    account: {
      async requestCode({ input, context }) {
        await arrive('account.requestCode', context);
        const code = String(100_001 + sentCodes.length);
        codes.set(input.email, { code, triesLeft: CODE_TRIES });
        sentCodes.push({ email: input.email, code });
        return {};
      },
      async verifyCode({ input, context, errors }) {
        await arrive('account.verifyCode', context);
        const live = codes.get(input.email);
        if (live === undefined) throw errors.CODE_EXPIRED();
        if (live.code !== input.code) {
          live.triesLeft -= 1;
          if (live.triesLeft === 0) codes.delete(input.email);
          throw errors.WRONG_CODE({ data: { triesLeft: live.triesLeft } });
        }
        codes.delete(input.email);
        return startSession(input.email);
      },
      async signInWithGoogle({ input, context, errors }) {
        await arrive('account.signInWithGoogle', context);
        const identity = fakeGoogleIdentityOf(input.idToken);
        if (identity === undefined) throw errors.INVALID_TOKEN();
        if (!identity.verified) throw errors.EMAIL_NOT_VERIFIED();
        return startSession(identity.email.trim().toLowerCase());
      },
      async signInWithApple({ input, context, errors }) {
        await arrive('account.signInWithApple', context);
        const identity = fakeAppleIdentityOf(input.idToken);
        if (identity === undefined || identity.expired) throw errors.INVALID_TOKEN();
        return startSession(identity.email.trim().toLowerCase());
      },
      async me({ context }) {
        await arrive('account.me', context);
        const email = sessionOf(context);
        return { email, createdAt: accounts.get(email)?.createdAt ?? clock.now().toISOString() };
      },
      async signOut({ context }) {
        await arrive('account.signOut', context);
        sessionOf(context);
        sessions.delete(context.headers.get('authorization')?.replace(/^Bearer /, '') ?? '');
        return {};
      },
      async signOutEverywhere({ context }) {
        await arrive('account.signOutEverywhere', context);
        endSessionsOf(sessionOf(context));
        return {};
      },
      async delete({ context }) {
        await arrive('account.delete', context);
        const email = sessionOf(context);
        endSessionsOf(email);
        accounts.delete(email);
        return {};
      },
    },
    sync: {
      async push({ input, context }) {
        await arrive('sync.push', context);
        // Of two changes of one key, the later is kept, the first on a tie, and only then cut.
        const latest = new Map<string, (typeof input.changes)[number]>();
        for (const change of input.changes) {
          const before = latest.get(change.key);
          if (before === undefined || change.changedAt > before.changedAt) {
            latest.set(change.key, change);
          }
        }
        const now = clock.now().getTime();
        for (const { key, value, changedAt } of latest.values()) {
          const kept = records.get(key);
          const cut = Math.min(changedAt, now);
          if (kept === undefined || cut > kept.changedAt) {
            sequence += 1;
            records.set(key, { value, changedAt: cut, sequence });
          }
        }
        return {};
      },
      async pull({ input, context }) {
        await arrive('sync.pull', context);
        const after = input.after;
        const following = [...records]
          .filter(([, record]) => record.sequence > (after ?? 0))
          .sort(([, first], [, second]) => first.sequence - second.sequence);
        const page = following.slice(0, SYNC_BATCH_SIZE);
        return {
          records: page.map(([key, { value, changedAt }]) => ({ key, value, changedAt })),
          cursor: page.at(-1)?.[1].sequence ?? after ?? 0,
          more: following.length > page.length,
        };
      },
    },
    reports: {
      async send({ input, context }) {
        await arrive('reports.send', context);
        received.push(input);
      },
    },
    collectionLinks: {
      async create({ input, context }) {
        await arrive('collectionLinks.create', context);
        made.push(input);
        const id = `link${String(made.length).padStart(6, '0')}`;
        linksById.set(id, input);
        return { id, url: `https://${domain}/${input.edition}/c/${id}` };
      },
      async read({ input, context, errors }) {
        await arrive('collectionLinks.read', context);
        const link = linksById.get(input.id);
        if (link === undefined) throw errors.NOT_FOUND();
        return link;
      },
    },
    content: {
      async latest({ input, context }) {
        packFormatsAsked.push(input.packFormat);
        await arrive('content.latest', context);
        const newest = packs
          .filter((pack) => pack.packFormat === input.packFormat)
          .reduce<FakePublishedPack | undefined>(
            (found, pack) =>
              found === undefined || pack.contentVersion > found.contentVersion ? pack : found,
            undefined,
          );
        if (newest === undefined) return { pack: null };
        const {
          contentVersion,
          packFormat,
          bytes,
          fileSha256 = bytesToHex(sha256(bytes)),
        } = newest;
        return { pack: { contentVersion, packFormat, size: bytes.length, fileSha256 } };
      },
      async download({ input, context, errors }) {
        const { contentVersion } = input.params;
        downloaded.push(contentVersion);
        await arrive('content.download', context);
        const pack = packs.find((published) => published.contentVersion === contentVersion);
        if (pack === undefined) throw errors.NOT_FOUND();
        const file = fileOf(pack.bytes, `pack-${String(contentVersion)}.db`, PACK_MEDIA_TYPE);
        return {
          status: 200,
          headers: { etag: `"${bytesToHex(sha256(pack.bytes))}"`, 'cache-control': 'immutable' },
          body: file,
        };
      },
    },
    counters: {
      async read({ input, context }) {
        countersAsked.push([...input.entries]);
        await arrive('counters.read', context);
        return {
          counters: input.entries.map((entryId) => ({
            entryId,
            ...(counts.get(entryId) ?? { known: 0, unknown: 0, saved: 0 }),
          })),
        };
      },
      async send({ input, context }) {
        await arrive('counters.send', context);
        sent.push(input.events.map((event) => ({ ...event })));
      },
      async questionnaire({ input, context }) {
        await arrive('counters.questionnaire', context);
        answers.push({ ...input });
      },
      async communityWord({ context }) {
        await arrive('counters.communityWord', context);
        return { communityWord: communityWord ?? null };
      },
    },
    edition: {
      async switches({ input, context }) {
        const named = input.headers?.['if-none-match'];
        etagsAsked.push(named);
        await arrive('edition.switches', context);
        const etag = etagOf(off);
        return named === etag
          ? { status: 304, headers: { etag } }
          : { status: 200, headers: { etag }, body: { off: [...off] } };
      },
    },
  };

  const serve = serveApi(procedures);
  /** Serves the request in process, and loses the answer of one the fake fails as unanswered. */
  const fetch: ApiFetch = async (request) => {
    const underWay: ServedRequest = { offline: false };
    served.set(request.headers, underWay);
    const response = await serve(request);
    if (underWay.offline) throw new TypeError('Network request failed');
    return response;
  };

  return {
    backend: createApiClient({ url: 'http://backend.test', fetch }),
    get calls() {
      return [...calls];
    },
    get online() {
      return fake.online;
    },
    set online(up: boolean) {
      fake.online = up;
    },
    failNext(...next) {
      failures.push(
        ...next.map((failure) => (typeof failure === 'string' ? { reason: failure } : failure)),
      );
    },
    hold() {
      let release: () => void = () => undefined;
      held = new Promise((resolve) => {
        release = resolve;
      });
      return release;
    },
    account: {
      get sentCodes() {
        return [...sentCodes];
      },
      get accounts() {
        return [...accounts.keys()];
      },
      get sessionTokens() {
        return [...sessions.keys()];
      },
      expireCodes() {
        codes.clear();
      },
      endSessions() {
        sessions.clear();
      },
    },
    sync: { records },
    reports: { received },
    collectionLinks: { made },
    content: {
      asked: packFormatsAsked,
      downloaded,
      publish(pack) {
        packs.push(pack);
      },
    },
    counters: {
      asked: countersAsked,
      sent,
      answers,
      count(entryId, entryCounts) {
        counts.set(entryId, entryCounts);
      },
      answerCommunityWord(next) {
        communityWord = next;
      },
    },
    switches: {
      asked: etagsAsked,
      turnOff(...features) {
        off = [...features].sort();
      },
    },
  };
}
