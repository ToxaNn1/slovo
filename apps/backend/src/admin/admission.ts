import { createHash, timingSafeEqual } from 'node:crypto';

import { ORPCError } from '@orpc/server';
import type { apiContract } from '@slovo/contracts/api';
import { ADMIN_SESSION_COOKIE, ADMIN_WRITE_HEADER } from '@slovo/contracts/admin-api';
import type { AdminAccess, AdminSignIn, SignedInAdmin } from '@slovo/server-core';

/** Who may be declared a caller of an admin procedure (ADRs 0088 and 0198). */
export type AdminCallerKind = 'owner' | 'admin' | 'agent' | 'ci' | 'sign-in';

/**
 * One admin procedure's admission (ADR 0198): who may call it, and whether it
 * reads or writes. A write by an admin session needs the admin header; a
 * caller by a Bearer token (an Агент, CI) sends none.
 */
export type Admission =
  | {
      /** Власник; Власник and Адмін; or both and an Агент, which writes content only. */
      readonly callers:
        readonly ['owner'] | readonly ['owner', 'admin'] | readonly ['owner', 'admin', 'agent'];
      readonly access: 'read' | 'write';
    }
  | {
      /** CI by its history token; anyone stepping through a sign-in, with the header. */
      readonly callers: readonly ['ci'] | readonly ['sign-in'];
      readonly access: 'write';
    };

/** An admission for every procedure of a contract router: a missing one does not compile. */
type AdmissionTable<Router> = {
  readonly [Key in keyof Router]: Router[Key] extends { readonly '~orpc': unknown }
    ? Admission
    : AdmissionTable<Router[Key]>;
};

const OWNER = ['owner'] as const;
const PEOPLE = ['owner', 'admin'] as const;
const WRITERS = ['owner', 'admin', 'agent'] as const;

const read = <Callers extends typeof OWNER | typeof PEOPLE | typeof WRITERS>(callers: Callers) =>
  ({ callers, access: 'read' }) as const;
const write = <Callers extends typeof OWNER | typeof PEOPLE | typeof WRITERS>(callers: Callers) =>
  ({ callers, access: 'write' }) as const;

/** Who may call each admin procedure, and whether it writes (ADR 0198). */
export const ADMISSION = {
  requestCode: { callers: ['sign-in'], access: 'write' },
  verifyCode: { callers: ['sign-in'], access: 'write' },
  signIn: { callers: ['sign-in'], access: 'write' },
  me: read(PEOPLE),
  sessions: read(PEOPLE),
  signOut: write(PEOPLE),
  signOutEverywhere: write(PEOPLE),

  // Безпека (ADR 0088): a Власник only.
  actions: read(OWNER),
  people: read(OWNER),
  invite: write(OWNER),
  setRole: write(OWNER),
  removePerson: write(OWNER),
  agentTokens: read(OWNER),
  issueAgentToken: write(OWNER),
  revokeAgentToken: write(OWNER),
  listAccounts: read(OWNER),
  getAccount: read(OWNER),
  deleteAccount: write(OWNER),
  alertThresholds: read(OWNER),
  setAlertThreshold: write(OWNER),
  latestAlerts: read(OWNER),

  status: read(PEOPLE),
  switches: read(PEOPLE),
  setRules: write(PEOPLE),
  setMinimum: write(PEOPLE),
  kill: write(PEOPLE),
  analytics: read(PEOPLE),
  variantResults: read(PEOPLE),
  counters: read(PEOPLE),
  readerCounts: read(PEOPLE),
  editions: read(PEOPLE),
  editionCard: read(PEOPLE),

  // «Сервіси»: a Власник only; a plain value is read as a write.
  services: {
    list: read(OWNER),
    entries: read(OWNER),
    addEntry: write(OWNER),
    editEntry: write(OWNER),
    deleteEntry: write(OWNER),
    unlockVault: write(OWNER),
    revealEntry: write(OWNER),
    copyEntry: write(OWNER),
    add: write(OWNER),
    editMoney: write(OWNER),
    usage: read(OWNER),
    refreshUsage: write(OWNER),
    usdRate: read(OWNER),
  },

  content: {
    openBatch: write(WRITERS),
    create: write(WRITERS),
    edit: write(WRITERS),
    retire: write(WRITERS),
    flag: write(WRITERS),
    report: read(WRITERS),
    uploadIllustration: write(WRITERS),
    record: read(WRITERS),
    records: read(WRITERS),
    unchecked: read(WRITERS),
    // Only a person checks a record or asks for the other voices (ADR 0195).
    check: write(PEOPLE),
    checkAll: write(PEOPLE),
    addOtherVoices: write(PEOPLE),
  },

  // The Content queue is the Admin users' own (ADR 0088).
  contentQueue: {
    batches: read(PEOPLE),
    review: write(PEOPLE),
    rollback: write(PEOPLE),
    flags: read(PEOPLE),
    resolveFlag: write(PEOPLE),
    reports: read(PEOPLE),
    resolveReport: write(PEOPLE),
  },

  development: read(PEOPLE),
  ownerChecks: read(PEOPLE),
  tickOwnerCheck: write(PEOPLE),
  addOwnerCheck: write(PEOPLE),
  quality: read(PEOPLE),
  ciHistory: read(PEOPLE),
  pushCiRun: { callers: ['ci'], access: 'write' },
} as const satisfies AdmissionTable<typeof apiContract.admin>;

/** An Admin user calling by their admin session. */
export type AdminUserCaller = {
  readonly kind: 'admin-user';
  readonly token: string;
} & SignedInAdmin;

/** Who an admitted call is by. */
export type Caller =
  | AdminUserCaller
  | { readonly kind: 'agent'; readonly name: string }
  | { readonly kind: 'ci' }
  | { readonly kind: 'sign-in' };

/** The Admin user of a procedure whose admission admits Admin users alone. */
export function personOf(caller: Caller): AdminUserCaller {
  if (caller.kind === 'admin-user') return caller;
  throw new Error(`a ${caller.kind} caller of a procedure that admits Admin users alone`);
}

/** Who the Action log names for the caller of a write by an Admin user or an Агент. */
export function actorOf(
  caller: Caller,
):
  | { readonly kind: 'agent'; readonly name: string }
  | { readonly kind: 'admin-user'; readonly email: string } {
  if (caller.kind === 'agent') return { kind: 'agent', name: caller.name };
  return { kind: 'admin-user', email: personOf(caller).email };
}

/** The errors a procedure's contract lists, as oRPC keeps them. */
type ErrorMapOf = Readonly<
  Partial<Record<string, { readonly status?: number; readonly message?: string }>>
>;

type Refusal = 'NOT_FOUND' | 'UNAUTHORIZED' | 'FORBIDDEN';

/** The refusal as the procedure's own error of that code: its status and message. */
function refusalOf(code: Refusal, errorMap: ErrorMapOf): ORPCError<Refusal, undefined> {
  const listed = errorMap[code];
  if (listed === undefined) return new ORPCError(code);
  return new ORPCError(code, {
    defined: true,
    ...(listed.status === undefined ? {} : { status: listed.status }),
    ...(listed.message === undefined ? {} : { message: listed.message }),
  });
}

/** The bearer token of the request's `Authorization` header, if it carries one. */
function bearerOf(headers: Headers): string | undefined {
  const match = /^Bearer\s+(\S+)$/i.exec(headers.get('authorization') ?? '');
  return match?.[1];
}

/** The admin session token of the request's cookie, if it carries one. */
function sessionTokenOf(headers: Headers): string | undefined {
  for (const pair of (headers.get('cookie') ?? '').split(';')) {
    const [name, ...value] = pair.trim().split('=');
    if (name === ADMIN_SESSION_COOKIE) return value.join('=');
  }
  return undefined;
}

/** Whether two tokens are equal, in a time that tells nothing of where they differ. */
function sameToken(given: string, expected: string): boolean {
  const digest = (token: string) => createHash('sha256').update(token).digest();
  return timingSafeEqual(digest(given), digest(expected));
}

type AdmissionNode = Admission | { readonly [key: string]: AdmissionNode };

const isAdmission = (node: AdmissionNode): node is Admission =>
  Array.isArray(node.callers) && typeof node.access === 'string';

/** The admission of the procedure at the path of the API router (`admin`, then its keys). */
export function admissionAt(path: readonly string[]): Admission {
  const [root, ...keys] = path;
  let node: AdmissionNode | undefined = root === 'admin' ? ADMISSION : undefined;
  for (const key of keys) node = node === undefined || isAdmission(node) ? undefined : node[key];
  if (node === undefined || !isAdmission(node)) {
    throw new Error(`no admission is declared for ${path.join('.')}`);
  }
  return node;
}

const admits = (callers: readonly AdminCallerKind[], kind: AdminCallerKind) =>
  callers.includes(kind);

/**
 * The admission of every admin procedure (ADR 0198), before its input is
 * read: 404 while no Власник exists, then who calls, in the order the admin
 * has always refused in. A write that no Агент may call needs the header
 * first; one an Агент may call asks it of an admin session alone.
 */
export function admission({
  admin,
  signIn,
  ciToken,
}: {
  readonly admin: Pick<AdminAccess, 'isOn' | 'agentOf'>;
  readonly signIn: Pick<AdminSignIn, 'sessionOf'>;
  readonly ciToken: string | undefined;
}) {
  return async function admit(
    path: readonly string[],
    headers: Headers,
    errorMap: ErrorMapOf,
  ): Promise<Caller> {
    const { callers, access } = admissionAt(path);
    const refuse = (code: Refusal) => refusalOf(code, errorMap);
    if (!(await admin.isOn())) throw refuse('NOT_FOUND');
    const header = headers.get(ADMIN_WRITE_HEADER) !== null;
    const token = bearerOf(headers);
    if (admits(callers, 'ci')) {
      if (ciToken === undefined || token === undefined || !sameToken(token, ciToken)) {
        throw refuse('UNAUTHORIZED');
      }
      return { kind: 'ci' };
    }
    const writes = access === 'write';
    if (writes && !header && !admits(callers, 'agent')) throw refuse('FORBIDDEN');
    if (admits(callers, 'sign-in')) return { kind: 'sign-in' };
    if (token !== undefined) {
      const name = await admin.agentOf(token);
      if (name === undefined) throw refuse('UNAUTHORIZED');
      if (!admits(callers, 'agent')) throw refuse('FORBIDDEN');
      return { kind: 'agent', name };
    }
    const session = sessionTokenOf(headers);
    const user = session === undefined ? undefined : await signIn.sessionOf(session);
    if (session === undefined || user === undefined) throw refuse('UNAUTHORIZED');
    if (!admits(callers, user.role)) throw refuse('FORBIDDEN');
    if (writes && !header) throw refuse('FORBIDDEN');
    return { kind: 'admin-user', token: session, ...user };
  };
}
