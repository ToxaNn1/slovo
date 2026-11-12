import { createHash, timingSafeEqual } from 'node:crypto';

import type { Illustrations } from '../content/illustrations';
import { implement } from '@orpc/server';
import { apiContract } from '@slovo/contracts/api';
import {
  ALERT_THRESHOLD_KEYS,
  type AlertThresholdKey,
  ADMIN_SESSION_COOKIE,
  ADMIN_WRITE_HEADER,
  ALL_EDITIONS,
  PERIOD_DAYS,
} from '@slovo/contracts/admin-api';
import { ALERT_THRESHOLD_DEFAULTS } from '@slovo/server-core';
import type {
  AlertSettings,
  AlertStore,
  AccessResult,
  Actor,
  AdminAccess,
  AdminAnalytics,
  AdminSignIn,
  DevelopmentOverview,
  Edition,
  EditionRegistry,
  EditionSwitches,
  Mailer,
  OwnerCheck,
  OwnerChecks,
  Quality,
  QualityKpi,
  SignInRefused,
  SignedInAdmin,
  SwitchRefusal,
  SwitchRefused,
} from '@slovo/server-core';

import { alertText } from '../alerts/owner-chat';
import type { ContentQueue } from '../content/content-queue';
import type { ContentWrites, WriteRefusal, Writer } from '../content/content-writes';
import { adminInviteEmail } from './admin-mail';

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

/** Whether two tokens are equal, in a time that tells nothing of where they differ. */
function sameToken(given: string, expected: string): boolean {
  const digest = (token: string) => createHash('sha256').update(token).digest();
  return timingSafeEqual(digest(given), digest(expected));
}

/** A Sentry number as the contract carries it: its freshness as an ISO time. */
const kpiOf = (kpi: QualityKpi) =>
  kpi.state === 'ok' ? { ...kpi, fetchedAt: kpi.fetchedAt.toISOString() } : kpi;

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
  illustrations: Illustrations,
  mailer: Mailer,
  development: DevelopmentOverview,
  contentQueue: ContentQueue,
  ownerChecks: OwnerChecks,
  analytics: AdminAnalytics,
  {
    quality,
    ciToken,
    alertSettings,
    alertStore,
  }: {
    readonly quality: Quality;
    readonly ciToken: string | undefined;
    readonly alertSettings: AlertSettings;
    readonly alertStore: AlertStore;
  },
) {
  const os = implement(apiContract.admin).$context<{
    headers: Headers;
    resHeaders?: Headers;
    /** The IP address of the request's connection. */
    ip: string;
  }>();

  /** The Editions an Аналітика read sums: the one named, or every Edition served for `all`. */
  function editionIdsOf(editionId: string, errors: Pick<AdminErrors, 'NOT_FOUND'>): string[] {
    const ids = served.map(({ config }) => config.id);
    if (editionId === ALL_EDITIONS) return ids;
    if (!ids.includes(editionId)) throw errors.NOT_FOUND();
    return [editionId];
  }

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

  /** Admits CI by the CI history token (ADR 0096); no other caller pushes CI runs. */
  async function admitCi(headers: Headers, errors: AdminErrors): Promise<void> {
    if (!(await admin.isOn())) throw errors.NOT_FOUND();
    const token = bearerOf(headers);
    if (ciToken === undefined || token === undefined || !sameToken(token, ciToken)) {
      throw errors.UNAUTHORIZED();
    }
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

  /** The email of the Admin user calling the Content queue; an Агент is refused. */
  async function queueCaller(headers: Headers, errors: AdminErrors, writes = false) {
    const caller = await admit(headers, errors, { writes });
    if (caller.kind !== 'admin-user') throw errors.FORBIDDEN();
    return caller.email;
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
    return { states: result.states, rules: [...result.rules], minimums: result.minimums };
  }

  /** Throws the refusal by name of a Безпека write the contract lists. */
  function done(
    result: AccessResult,
    errors: {
      CONFLICT: (options: {
        data: { refusal: Extract<AccessResult, { ok: false }>['reason'] };
      }) => Error;
    },
  ) {
    if (!result.ok) throw errors.CONFLICT({ data: { refusal: result.reason } });
  }

  /** Admits a Власник to a Безпека write, and names them with the reason for the Action log. */
  async function securityWrite(headers: Headers, errors: AdminErrors, reason: string) {
    const caller = await admit(headers, errors, { security: true, writes: true });
    return { who: actorOf(caller), reason };
  }

  /** The Admin user's own session; another caller is refused. */
  async function ownSession(headers: Headers, errors: AdminErrors, needs: Needs = {}) {
    const caller = await admit(headers, errors, needs);
    if (caller.kind !== 'admin-user') throw errors.FORBIDDEN();
    return caller;
  }

  /**
   * Who a content procedure is called by: an Агент by its token, or an Admin
   * user (Адмін or Власник) of a session, whose writes need the admin header.
   */
  async function writerOf(headers: Headers, errors: AdminErrors, { writes = true } = {}) {
    const caller = await admit(headers, errors, { writesContent: true });
    if (caller.kind === 'admin-user' && writes && headers.get(ADMIN_WRITE_HEADER) === null) {
      throw errors.FORBIDDEN();
    }
    const writer: Writer =
      caller.kind === 'agent'
        ? { kind: 'agent', name: caller.name }
        : { kind: 'admin-user', email: caller.email };
    return writer;
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
  const queue = os.contentQueue;
  return os.router({
    requestCode: os.requestCode.handler(async ({ context, input, errors }) => {
      await admitSignIn(context.headers, errors);
      await signIn.requestCode(input.email, context.ip);
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
        actions: actions.map(({ at, who, what, before, after, reason, editionId }) => ({
          at: at.toISOString(),
          who,
          what,
          before,
          after,
          reason,
          editionId,
        })),
      };
    }),

    people: os.people.handler(async ({ context, errors }) => {
      await admit(context.headers, errors, { security: true });
      const people = await admin.people();
      return {
        people: people.map(({ email, role, totp }) => ({
          email,
          role,
          signedInYet: totp.state === 'on',
        })),
      };
    }),

    invite: os.invite.handler(async ({ context, input, errors }) => {
      const write = await securityWrite(context.headers, errors, input.reason);
      const announce = (to: string) => mailer.send({ to, ...adminInviteEmail(input.role) });
      done(await admin.invite(input.email, input.role, write, announce), errors);
      return { invited: true as const };
    }),

    setRole: os.setRole.handler(async ({ context, input, errors }) => {
      const write = await securityWrite(context.headers, errors, input.reason);
      done(await admin.setRole(input.email, input.role, write), errors);
      return { changed: true as const };
    }),

    removePerson: os.removePerson.handler(async ({ context, input, errors }) => {
      const write = await securityWrite(context.headers, errors, input.reason);
      done(await admin.remove(input.email, write), errors);
      return { removed: true as const };
    }),

    agentTokens: os.agentTokens.handler(async ({ context, errors }) => {
      await admit(context.headers, errors, { security: true });
      const tokens = await admin.agents();
      return {
        tokens: tokens.map(({ name, createdAt, revokedAt }) => ({
          name,
          createdAt: createdAt.toISOString(),
          revokedAt: revokedAt?.toISOString() ?? null,
        })),
      };
    }),

    issueAgentToken: os.issueAgentToken.handler(async ({ context, input, errors }) => {
      const write = await securityWrite(context.headers, errors, input.reason);
      const added = await admin.addAgent(input.name, write);
      if (!added.ok) throw errors.CONFLICT({ data: { refusal: 'name-taken' } });
      return { name: input.name, token: added.token };
    }),

    revokeAgentToken: os.revokeAgentToken.handler(async ({ context, input, errors }) => {
      const write = await securityWrite(context.headers, errors, input.reason);
      if (!(await admin.revokeAgent(input.name, write))) {
        throw errors.CONFLICT({ data: { refusal: 'unknown' } });
      }
      return { revoked: true as const };
    }),

    alertThresholds: os.alertThresholds.handler(async ({ context, errors }) => {
      await admit(context.headers, errors, { security: true });
      const values = await alertSettings.thresholds();
      return { thresholds: ALERT_THRESHOLD_KEYS.map((key) => thresholdView(key, values[key])) };
    }),

    setAlertThreshold: os.setAlertThreshold.handler(async ({ context, input, errors }) => {
      const write = await securityWrite(context.headers, errors, input.reason);
      await alertSettings.set(input.key, input.value, write);
      return { threshold: thresholdView(input.key, input.value) };
    }),

    latestAlerts: os.latestAlerts.handler(async ({ context, errors }) => {
      await admit(context.headers, errors, { security: true });
      const kept = await alertStore.latest(LATEST_ALERTS);
      return {
        alerts: kept.map(({ id, at, alert, sentAt }) => ({
          id,
          at: at.toISOString(),
          kind: alert.kind,
          text: alertText(alert),
          sentAt: sentAt?.toISOString() ?? null,
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
      return { states: switches.states, rules: [...switches.rules], minimums: switches.minimums };
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

    analytics: os.analytics.handler(async ({ context, input, errors }) => {
      await admit(context.headers, errors);
      const read = await analytics.overview(editionIdsOf(input.editionId, errors), {
        from: input.from,
        to: input.to,
      });
      if (!read.ok) throw errors.ANALYTICS_UNAVAILABLE();
      const { activeByDay, visitsByDay, medianVisitSeconds, devices, appVersions } = read.value;
      return {
        activeByDay: [...activeByDay],
        visitsByDay: [...visitsByDay],
        medianVisitSeconds,
        devices: [...devices],
        appVersions: [...appVersions],
        fetchedAt: read.fetchedAt.toISOString(),
      };
    }),

    variantResults: os.variantResults.handler(async ({ context, input, errors }) => {
      await admit(context.headers, errors);
      const read = await analytics.variants(editionIdsOf(input.editionId, errors), input.feature);
      if (!read.ok) throw errors.ANALYTICS_UNAVAILABLE();
      return { variants: [...read.value], fetchedAt: read.fetchedAt.toISOString() };
    }),

    counters: os.counters.handler(async ({ context, input, errors }) => {
      await admit(context.headers, errors);
      const { totals, answers } = await analytics.counters(editionIdsOf(input.editionId, errors));
      return { ...totals, answers: [...answers] };
    }),

    editions: os.editions.handler(async ({ context, errors }) => {
      await admit(context.headers, errors);
      return {
        editions: served.map(({ config }) => ({ id: config.id, displayName: config.displayName })),
      };
    }),

    editionCard: os.editionCard.handler(async ({ context, input, errors }) => {
      await admit(context.headers, errors);
      const edition = served.find(({ config }) => config.id === input.editionId);
      if (edition === undefined) throw errors.NOT_FOUND();
      const { id, displayName, locale, categories, correctionCategories, levels } = edition.config;
      return { id, displayName, locale, categories, correctionCategories, levels };
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
        await writerOf(context.headers, errors, { writes: false });
        const reported = await contentWrites.report(input.editionId);
        if (!reported.ok) throw refusalOf(reported, errors);
        const { ok: _ok, ...report } = reported;
        return report;
      }),
      uploadIllustration: content.uploadIllustration.handler(async ({ context, input, errors }) => {
        await writerOf(context.headers, errors);
        const uploaded = await illustrations.upload(
          input.editionId,
          input.id,
          Buffer.from(input.png, 'base64'),
        );
        if (!uploaded.ok) throw refusalOf(uploaded, errors);
        const { ok: _ok, ...answer } = uploaded;
        return answer;
      }),
      record: content.record.handler(async ({ context, input, errors }) => {
        await writerOf(context.headers, errors, { writes: false });
        const found = await contentWrites.record(input.editionId, input.kind, input.id);
        if (!found.ok) throw refusalOf(found, errors);
        const { ok: _ok, ...record } = found;
        if (input.kind !== 'word') return record;
        const illustration = await illustrations.live(input.editionId, input.id);
        return illustration === undefined ? record : { ...record, illustration };
      }),
      records: content.records.handler(async ({ context, input, errors }) => {
        await writerOf(context.headers, errors, { writes: false });
        const { editionId, kind, ...filters } = input;
        const listed = await contentWrites.list(editionId, kind, filters);
        if (!listed.ok) throw refusalOf(listed, errors);
        return { records: listed.records, total: listed.total };
      }),
    },
    contentQueue: {
      batches: queue.batches.handler(async ({ context, input, errors }) => {
        await queueCaller(context.headers, errors);
        return { batches: await contentQueue.batches(input.editionId) };
      }),
      review: queue.review.handler(async ({ context, input, errors }) => {
        const email = await queueCaller(context.headers, errors, true);
        const reviewed = await contentQueue.review(email, input.batchId, input.reason);
        if (!reviewed.ok) throw errors.NOT_FOUND();
        return { reviewed: true as const };
      }),
      rollback: queue.rollback.handler(async ({ context, input, errors }) => {
        const email = await queueCaller(context.headers, errors, true);
        const rolledBack = await contentQueue.rollback(email, input.batchId, input.reason);
        if (!rolledBack.ok) throw errors.NOT_FOUND();
        const { ok: _ok, ...answer } = rolledBack;
        return answer;
      }),
      flags: queue.flags.handler(async ({ context, input, errors }) => {
        await queueCaller(context.headers, errors);
        return { flags: await contentQueue.flags(input.editionId) };
      }),
      resolveFlag: queue.resolveFlag.handler(async ({ context, input, errors }) => {
        const email = await queueCaller(context.headers, errors, true);
        const resolved = await contentQueue.resolveFlag(
          email,
          input.id,
          input.decision,
          input.reason,
        );
        if (!resolved.ok) throw errors.NOT_FOUND();
        return { resolved: true as const };
      }),
      reports: queue.reports.handler(async ({ context, input, errors }) => {
        await queueCaller(context.headers, errors);
        return { reports: await contentQueue.reports(input.editionId) };
      }),
      resolveReport: queue.resolveReport.handler(async ({ context, input, errors }) => {
        const email = await queueCaller(context.headers, errors, true);
        const resolved = await contentQueue.resolveReport(email, input.id, input.reason);
        if (!resolved.ok) throw errors.NOT_FOUND();
        return { resolved: true as const };
      }),
    },
    development: os.development.handler(async ({ context, errors }) => {
      await admit(context.headers, errors);
      return development.overview();
    }),

    ownerChecks: os.ownerChecks.handler(async ({ context, input, errors }) => {
      await admit(context.headers, errors);
      const checks = await ownerChecks.list(input.version);
      const open: Record<string, number> = {};
      for (const check of checks) {
        open[check.version] = (open[check.version] ?? 0) + (check.ticked === null ? 1 : 0);
      }
      return { checks: checks.map(ownerCheckView), open };
    }),

    tickOwnerCheck: os.tickOwnerCheck.handler(async ({ context, input, errors }) => {
      const caller = await admit(context.headers, errors, { writes: true });
      if ((await ownerChecks.tick(input.id, actorOf(caller))) === 'unknown') {
        throw errors.NOT_FOUND();
      }
      const check = (await ownerChecks.list()).find(({ id }) => id === input.id);
      if (!check) throw errors.NOT_FOUND();
      return { check: ownerCheckView(check) };
    }),

    addOwnerCheck: os.addOwnerCheck.handler(async ({ context, input, errors }) => {
      const caller = await admit(context.headers, errors, { writes: true });
      const check = await ownerChecks.add(input.version, input.text, actorOf(caller));
      return { check: ownerCheckView(check) };
    }),

    quality: os.quality.handler(async ({ context, input, errors }) => {
      await admit(context.headers, errors);
      const answer = await quality.read({
        editionId: input.editionId,
        days: PERIOD_DAYS[input.period],
      });
      const {
        crashFree,
        crashes,
        errors: errorCount,
        newIssues,
        backendP95,
        appStart,
      } = answer.kpis;
      return {
        capped: answer.capped,
        from: answer.from.toISOString(),
        to: answer.to.toISOString(),
        kpis: {
          crashFree: kpiOf(crashFree),
          crashes: kpiOf(crashes),
          errors: kpiOf(errorCount),
          newIssues: kpiOf(newIssues),
          backendP95: kpiOf(backendP95),
          appStart: kpiOf(appStart),
        },
      };
    }),

    ciHistory: os.ciHistory.handler(async ({ context, input, errors }) => {
      await admit(context.headers, errors);
      const runs = await quality.ciHistory(PERIOD_DAYS[input.period]);
      return {
        runs: runs.map((run) => ({
          ...run,
          at: run.at.toISOString(),
          failedTests: [...run.failedTests],
          flakyTests: [...run.flakyTests],
          coverage: [...run.coverage],
          jobs: [...run.jobs],
        })),
      };
    }),

    // Data CI pushes, not an admin change: no Action log row.
    pushCiRun: os.pushCiRun.handler(async ({ context, input, errors }) => {
      await admitCi(context.headers, errors);
      await quality.pushCiRun({ ...input, at: new Date(input.at) });
      return { kept: true as const };
    }),
  });
}

/** How many of the newest alerts Огляд lists. */
const LATEST_ALERTS = 20;

const thresholdView = (key: AlertThresholdKey, value: number) => ({
  key,
  value,
  default: ALERT_THRESHOLD_DEFAULTS[key],
});

/** Who changed something, as the admin shows it. */
function actorName(who: Actor): string {
  switch (who.kind) {
    case 'admin-user':
      return who.email;
    case 'agent':
      return who.name;
    case 'command':
      return who.command;
  }
}

function ownerCheckView(check: OwnerCheck) {
  return {
    id: check.id,
    version: check.version,
    text: check.text,
    addedBy: actorName(check.addedBy),
    addedAt: check.addedAt.toISOString(),
    ticked:
      check.ticked === null
        ? null
        : { at: check.ticked.at.toISOString(), by: actorName(check.ticked.by) },
  };
}
