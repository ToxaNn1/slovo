import { implement } from '@orpc/server';
import { apiContract } from '@slovo/contracts/api';
import { ADMIN_SESSION_COOKIE, ADMIN_WRITE_HEADER } from '@slovo/contracts/admin-api';
import type {
  Actor,
  AdminAccess,
  AdminSignIn,
  Edition,
  EditionRegistry,
  EditionSwitches,
  SignInRefused,
  SignedInAdmin,
  SwitchRefusal,
  SwitchRefused,
} from '@slovo/server-core';

import type { ContentWrites, WriteRefusal } from '../content/content-writes';

/** The path the admin session cookie is sent on: the admin API's. */
const COOKIE_PATH = '/v1/admin';
/** The cookie's life: a session's longest; the backend ends it sooner when idle. */
const COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

/** The bearer token of the request's `Authorization` header, if it carries one. */
function bearerOf(headers: Headers): string | undefined {
  const match = /^Bearer\s+(\S+)$/i.exec(headers.get('authorization') ?? '');
  return match?.[1];
}

/** The admin session token of the request's cookie, if it carries one. */
export function sessionTokenOf(headers: Headers): string | undefined {
  for (const pair of (headers.get('cookie') ?? '').split(';')) {
    const [name, ...value] = pair.trim().split('=');
    if (name === ADMIN_SESSION_COOKIE) return value.join('=');
  }
  return undefined;
}

const cookie = (value: string, maxAge: number) =>
  `${ADMIN_SESSION_COOKIE}=${value}; Path=${COOKIE_PATH}; Max-Age=${String(maxAge)}; HttpOnly; Secure; SameSite=Strict`;

/** Who calls an admin procedure: a signed-in Admin user, or an Агент. */
export type AdminCaller =
  | ({ readonly kind: 'admin-user'; readonly token: string } & SignedInAdmin)
  | { readonly kind: 'agent'; readonly name: string };

/** What a procedure asks of its caller. */
interface Needs {
  /** It writes content: an Агент may call it. */
  readonly writesContent?: boolean;
  /** It writes: the admin header must come with it. */
  readonly writes?: boolean;
  /** It is a Безпека procedure: a Власник only. */
  readonly security?: boolean;
}

interface AdminErrors {
  NOT_FOUND: () => Error;
  UNAUTHORIZED: () => Error;
  FORBIDDEN: () => Error;
}

/**
 * The admin API (ADR 0088). Every procedure answers 404 while no Власник
 * exists. A caller is the Admin user of the session cookie, or an Агент by
 * its token on the content-writing procedures alone; any other Bearer, an
 * Account's Session among them, answers 401. A write needs the admin header;
 * a Безпека procedure needs a Власник.
 */
export function adminProcedures(
  admin: AdminAccess,
  signIn: AdminSignIn,
  editions: EditionRegistry,
  served: readonly Edition[],
  contentWrites: ContentWrites,
) {
  const os = implement(apiContract.admin).$context<{ headers: Headers; resHeaders?: Headers }>();

  /** Admits the caller to a procedure, or throws the refusal the contract lists. */
  async function admit(
    headers: Headers,
    errors: AdminErrors,
    { writesContent = false, writes = false, security = false }: Needs = {},
  ): Promise<AdminCaller> {
    if (!(await admin.isOn())) throw errors.NOT_FOUND();
    if (writes && headers.get(ADMIN_WRITE_HEADER) === null) throw errors.FORBIDDEN();
    const token = bearerOf(headers);
    if (token !== undefined) {
      const name = await admin.agentOf(token);
      if (name === undefined) throw errors.UNAUTHORIZED();
      if (!writesContent) throw errors.FORBIDDEN();
      return { kind: 'agent', name };
    }
    const session = sessionTokenOf(headers);
    const user = session === undefined ? undefined : await signIn.sessionOf(session);
    if (session === undefined || user === undefined) throw errors.UNAUTHORIZED();
    if (security && user.role !== 'owner') throw errors.FORBIDDEN();
    return { kind: 'admin-user', token: session, ...user };
  }

  /** Lets a sign-in step through: the admin is on and the header came. */
  async function admitSignIn(
    headers: Headers,
    errors: Pick<AdminErrors, 'NOT_FOUND' | 'FORBIDDEN'>,
  ) {
    if (!(await admin.isOn())) throw errors.NOT_FOUND();
    if (headers.get(ADMIN_WRITE_HEADER) === null) throw errors.FORBIDDEN();
  }

  /** Throws the refusal of a sign-in step the contract lists. */
  function refused(
    refusal: SignInRefused,
    errors: {
      UNAUTHORIZED: (options: { data: { attemptsLeft: number } }) => Error;
      TOO_MANY_REQUESTS: (options: { data: { retryAfterSeconds: number } }) => Error;
    },
  ): never {
    if (refusal.reason === 'wrong-code') {
      throw errors.UNAUTHORIZED({ data: { attemptsLeft: refusal.attemptsLeft } });
    }
    throw errors.TOO_MANY_REQUESTS({ data: { retryAfterSeconds: refusal.retryAfterSeconds } });
  }

  /** Who the Action log names for a caller of a write. */
  const actorOf = (caller: AdminCaller): Actor =>
    caller.kind === 'agent'
      ? { kind: 'agent', name: caller.name }
      : { kind: 'admin-user', email: caller.email };

  /** The answer of a switch write, or the refusal by name the contract lists. */
  function answered(
    result: EditionSwitches | SwitchRefused,
    errors: {
      BAD_REQUEST: (options: { data: { refusal: SwitchRefusal; feature: string } }) => Error;
    },
  ) {
    if (!result.ok) {
      throw errors.BAD_REQUEST({ data: { refusal: result.reason, feature: result.feature } });
    }
    return { rules: [...result.rules], minimums: result.minimums };
  }

  /** The Admin user's own session; another caller is refused. */
  async function ownSession(headers: Headers, errors: AdminErrors, needs: Needs = {}) {
    const caller = await admit(headers, errors, needs);
    if (caller.kind !== 'admin-user') throw errors.FORBIDDEN();
    return caller;
  }

  /** The Агент a content procedure is called by; until admin sessions exist, no one else writes content. */
  async function writerOf(
    headers: Headers,
    errors: { NOT_FOUND: () => Error; UNAUTHORIZED: () => Error },
  ) {
    if (!(await admin.isOn())) throw errors.NOT_FOUND();
    const token = bearerOf(headers);
    const name = token === undefined ? undefined : await admin.agentOf(token);
    if (name === undefined) throw errors.UNAUTHORIZED();
    return { name };
  }

  /** The refusal the contract lists for what the content store refused. */
  function refusalOf(
    refusal: WriteRefusal,
    errors: {
      NOT_FOUND: () => Error;
      NOT_IMPORTED: () => Error;
      REFUSED?: (options: {
        data: { refusals: { rule: string; message: string; entryId?: string; field?: string }[] };
      }) => Error;
      STALE?: (options: { data: { currentVersion: number } }) => Error;
    },
  ): Error {
    switch (refusal.reason) {
      case 'not-found':
        return errors.NOT_FOUND();
      case 'not-imported':
        return errors.NOT_IMPORTED();
      case 'refused': {
        const refusals = refusal.refusals.map(({ rule, entryId, field, message }) => ({
          rule,
          message,
          ...(entryId === undefined ? {} : { entryId }),
          ...(field === undefined ? {} : { field }),
        }));
        if (errors.REFUSED === undefined) throw new Error('a flag is never refused by a rule');
        return errors.REFUSED({ data: { refusals } });
      }
      case 'stale':
        if (errors.STALE === undefined) throw new Error('a flag is never stale');
        return errors.STALE({ data: { currentVersion: refusal.currentVersion } });
    }
  }

  const content = os.content;
  return os.router({
    requestCode: os.requestCode.handler(async ({ context, input, errors }) => {
      await admitSignIn(context.headers, errors);
      await signIn.requestCode(input.email);
      return { sent: true as const };
    }),

    verifyCode: os.verifyCode.handler(async ({ context, input, errors }) => {
      await admitSignIn(context.headers, errors);
      const result = await signIn.verifyCode(input.email, input.code);
      if (!result.ok) refused(result, errors);
      return result.next === 'totp'
        ? { next: 'totp' as const }
        : {
            next: 'enrol' as const,
            secret: result.secret,
            otpauthUrl: result.otpauthUrl,
            recoveryCodes: [...result.recoveryCodes],
          };
    }),

    signIn: os.signIn.handler(async ({ context, input, errors }) => {
      await admitSignIn(context.headers, errors);
      const result = await signIn.signIn(input.email, input.code, input.factor);
      if (!result.ok) refused(result, errors);
      context.resHeaders?.append('set-cookie', cookie(result.token, COOKIE_MAX_AGE_SECONDS));
      return { email: result.email, role: result.role };
    }),

    me: os.me.handler(async ({ context, errors }) => {
      const caller = await ownSession(context.headers, errors);
      return { email: caller.email, role: caller.role };
    }),

    sessions: os.sessions.handler(async ({ context, errors }) => {
      const caller = await ownSession(context.headers, errors);
      const sessions = await signIn.sessionsOf(caller.token);
      return {
        sessions: sessions.map(({ createdAt, lastSeenAt, current }) => ({
          createdAt: createdAt.toISOString(),
          lastSeenAt: lastSeenAt.toISOString(),
          current,
        })),
      };
    }),

    signOut: os.signOut.handler(async ({ context, errors }) => {
      const caller = await ownSession(context.headers, errors, { writes: true });
      await signIn.signOut(caller.token);
      context.resHeaders?.append('set-cookie', cookie('', 0));
      return { signedOut: true as const };
    }),

    signOutEverywhere: os.signOutEverywhere.handler(async ({ context, errors }) => {
      const caller = await ownSession(context.headers, errors, { writes: true });
      await signIn.signOutEverywhere(caller.token);
      context.resHeaders?.append('set-cookie', cookie('', 0));
      return { signedOut: true as const };
    }),

    actions: os.actions.handler(async ({ context, input, errors }) => {
      await admit(context.headers, errors, { security: true });
      const actions = await admin.actions(input.editionId);
      return {
        actions: actions.map(({ at, who, what, reason, editionId }) => ({
          at: at.toISOString(),
          who,
          what,
          reason,
          editionId,
        })),
      };
    }),

    status: os.status.handler(async ({ context, errors }) => {
      await admit(context.headers, errors);
      return { on: true as const };
    }),

    switches: os.switches.handler(async ({ context, input, errors }) => {
      await admit(context.headers, errors);
      const switches = await editions.switches(input.editionId);
      if (!switches.ok) throw errors.NOT_FOUND();
      return { rules: [...switches.rules], minimums: switches.minimums };
    }),

    setRules: os.setRules.handler(async ({ context, input, errors }) => {
      const caller = await admit(context.headers, errors, { writes: true });
      const result = await editions.setRules(input.editionId, input.feature, input.rules, {
        who: actorOf(caller),
        reason: input.reason,
      });
      return answered(result, errors);
    }),

    setMinimum: os.setMinimum.handler(async ({ context, input, errors }) => {
      const caller = await admit(context.headers, errors, { writes: true });
      const result = await editions.setMinimum(input.editionId, input.platform, input.minimum, {
        who: actorOf(caller),
        reason: input.reason,
      });
      return answered(result, errors);
    }),

    kill: os.kill.handler(async ({ context, input, errors }) => {
      const caller = await admit(context.headers, errors, { writes: true });
      const result = await editions.kill(input.feature, input.editionId, {
        who: actorOf(caller),
        reason: input.reason,
      });
      if (!result.ok) {
        throw errors.BAD_REQUEST({ data: { refusal: result.reason, feature: result.feature } });
      }
      return { editionIds: [...result.editionIds] };
    }),

    editions: os.editions.handler(async ({ context, errors }) => {
      await admit(context.headers, errors);
      return {
        editions: served.map(({ config }) => ({ id: config.id, displayName: config.displayName })),
      };
    }),

    content: {
      openBatch: content.openBatch.handler(async ({ context, input, errors }) => {
        const writer = await writerOf(context.headers, errors);
        const opened = await contentWrites.openBatch(writer, input.editionId);
        if (!opened.ok) throw refusalOf(opened, errors);
        return { batchId: opened.batchId };
      }),
      create: content.create.handler(async ({ context, input, errors }) => {
        const writer = await writerOf(context.headers, errors);
        const { fields, ...write } = input;
        const written = await contentWrites.write(writer, {
          ...write,
          change: { op: 'create', fields },
        });
        if (!written.ok) throw refusalOf(written, errors);
        return written.written;
      }),
      edit: content.edit.handler(async ({ context, input, errors }) => {
        const writer = await writerOf(context.headers, errors);
        const { id, recordVersion, fields, ...write } = input;
        const written = await contentWrites.write(writer, {
          ...write,
          change: { op: 'edit', id, recordVersion, fields },
        });
        if (!written.ok) throw refusalOf(written, errors);
        return written.written;
      }),
      retire: content.retire.handler(async ({ context, input, errors }) => {
        const writer = await writerOf(context.headers, errors);
        const { id, recordVersion, ...write } = input;
        const written = await contentWrites.write(writer, {
          ...write,
          change: { op: 'retire', id, recordVersion },
        });
        if (!written.ok) throw refusalOf(written, errors);
        return written.written;
      }),
      flag: content.flag.handler(async ({ context, input, errors }) => {
        const writer = await writerOf(context.headers, errors);
        const flagged = await contentWrites.flag(writer, input);
        if (!flagged.ok) throw refusalOf(flagged, errors);
        return { id: input.id, batchId: input.batchId };
      }),
      report: content.report.handler(async ({ context, input, errors }) => {
        await writerOf(context.headers, errors);
        const reported = await contentWrites.report(input.editionId);
        if (!reported.ok) throw refusalOf(reported, errors);
        const { ok: _ok, ...report } = reported;
        return report;
      }),
      record: content.record.handler(async ({ context, input, errors }) => {
        await writerOf(context.headers, errors);
        const found = await contentWrites.record(input.editionId, input.kind, input.id);
        if (!found.ok) throw refusalOf(found, errors);
        return { fields: found.fields, recordVersion: found.recordVersion };
      }),
    },
  });
}
