import type { Illustrations } from '../content/illustrations';
import { implement } from '@orpc/server';
import { ID_PREFIX } from '@slovo/contracts';
import { apiContract } from '@slovo/contracts/api';
import {
  ALERT_THRESHOLD_KEYS,
  type AlertThresholdKey,
  ADMIN_SESSION_COOKIE,
  ALL_EDITIONS,
  PERIOD_DAYS,
} from '@slovo/contracts/admin-api';
import { ALERT_THRESHOLD_DEFAULTS } from '@slovo/server-core';
import type {
  Accounts,
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
  SwitchRefusal,
  SwitchRefused,
  ServiceEntries,
  ServiceStore,
  ServiceMoneyBook,
  ServiceUsage,
  UsdRates,
} from '@slovo/server-core';

import { alertText } from '../alerts/owner-chat';
import type { ContentQueue } from '../content/content-queue';
import type { ContentWrites, WriteRefusal } from '../content/content-writes';
import { servicesProcedures } from '../services/services-procedures';
import { adminInviteEmail } from './admin-mail';
import { actorOf, admission, personOf, type Caller } from './admission';

/** The path the admin session cookie is sent on: the admin API's. */
const COOKIE_PATH = '/v1/admin';
/** The cookie's life: a session's longest; the backend ends it sooner when idle. */
const COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

/** The kinds of Sync record the Account page names by their Entry; each key ends in the Entry's id. */
const ENTRY_NAMING_KINDS = ['favorites.', 'hidden.', 'knowledge.', 'collectionEntries.'];

/** The Entry id a Sync record's key names, when it is of a kind the Account page names by its Entry. */
function entryIdsOf(key: string): readonly string[] {
  if (!ENTRY_NAMING_KINDS.some((kind) => key.startsWith(kind))) return [];
  const id = key.slice(key.lastIndexOf('.') + 1);
  return Object.values(ID_PREFIX).some((prefix) => id.startsWith(prefix)) ? [id] : [];
}

/** A Sentry number as the contract carries it: its freshness as an ISO time. */
const kpiOf = (kpi: QualityKpi) =>
  kpi.state === 'ok' ? { ...kpi, fetchedAt: kpi.fetchedAt.toISOString() } : kpi;

const cookie = (value: string, maxAge: number) =>
  `${ADMIN_SESSION_COOKIE}=${value}; Path=${COOKIE_PATH}; Max-Age=${String(maxAge)}; HttpOnly; Secure; SameSite=Strict`;

interface AdminErrors {
  NOT_FOUND: () => Error;
}

/** What the admin API reads and writes. */
export interface AdminDependencies {
  readonly admin: AdminAccess;
  readonly signIn: AdminSignIn;
  readonly editions: EditionRegistry;
  /** The Editions the backend serves, as the admin lists them. */
  readonly served: readonly Edition[];
  readonly contentWrites: ContentWrites;
  readonly illustrations: Illustrations;
  readonly mailer: Mailer;
  readonly development: DevelopmentOverview;
  readonly contentQueue: ContentQueue;
  readonly ownerChecks: OwnerChecks;
  readonly analytics: AdminAnalytics;
  /** The readers' Accounts, which a Власник finds and deletes by email. */
  readonly accounts: Accounts;
  readonly quality: Quality;
  /** The token CI pushes its history with. */
  readonly ciToken: string | undefined;
  readonly alertSettings: AlertSettings;
  readonly alertStore: AlertStore;
  /** The Services of «Сервіси». */
  readonly services: ServiceStore;
  /** The Service entries of «Сервіси», sealed in the Vault. */
  readonly serviceEntries: ServiceEntries;
  /** What SLOVO pays for the Services, and the Власник's writes of it. */
  readonly serviceMoney: ServiceMoneyBook;
  /** The usage of the Services, read from their providers. */
  readonly serviceUsage: ServiceUsage;
  /** The NBU rate «Сервіси» counts the money in hryvnias at. */
  readonly usdRates: UsdRates;
}

/**
 * The admin API (ADR 0088). Who may call each procedure, and whether it
 * writes, is declared once in `ADMISSION` and admitted before the handler
 * runs (ADR 0198); a handler reads its caller from the context.
 */
export function adminProcedures({
  admin,
  signIn,
  editions,
  served,
  contentWrites,
  illustrations,
  mailer,
  development,
  contentQueue,
  ownerChecks,
  analytics,
  accounts,
  quality,
  ciToken,
  alertSettings,
  alertStore,
  services,
  serviceEntries,
  serviceMoney,
  serviceUsage,
  usdRates,
}: AdminDependencies) {
  const admit = admission({ admin, signIn, ciToken });
  const os = implement(apiContract.admin)
    .$context<{
      headers: Headers;
      resHeaders?: Headers;
      /** The IP address of the request's connection. */
      ip: string;
    }>()
    .use(async ({ context, path, procedure, next }) =>
      next({
        context: { caller: await admit(path, context.headers, procedure['~orpc'].errorMap) },
      }),
    );

  /** The Editions an Аналітика read sums: the one named, or every Edition served for `all`. */
  function editionIdsOf(editionId: string, errors: AdminErrors): string[] {
    const ids = served.map(({ config }) => config.id);
    if (editionId === ALL_EDITIONS) return ids;
    if (!ids.includes(editionId)) throw errors.NOT_FOUND();
    return [editionId];
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

  /** Who writes a Безпека or «Сервіси» change, and why, for the Action log. */
  const writeOf = (caller: Caller, reason: string) => ({ who: actorOf(caller), reason });

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
    requestCode: os.requestCode.handler(async ({ context, input }) => {
      await signIn.requestCode(input.email, context.ip);
      return { sent: true as const };
    }),

    verifyCode: os.verifyCode.handler(async ({ input, errors }) => {
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
      const result = await signIn.signIn(input.email, input.code, input.factor);
      if (!result.ok) refused(result, errors);
      context.resHeaders?.append('set-cookie', cookie(result.token, COOKIE_MAX_AGE_SECONDS));
      return { email: result.email, role: result.role };
    }),

    me: os.me.handler(({ context }) => {
      const { email, role } = personOf(context.caller);
      return { email, role };
    }),

    sessions: os.sessions.handler(async ({ context }) => {
      const caller = personOf(context.caller);
      const sessions = await signIn.sessionsOf(caller.token);
      return {
        sessions: sessions.map(({ createdAt, lastSeenAt, current }) => ({
          createdAt: createdAt.toISOString(),
          lastSeenAt: lastSeenAt.toISOString(),
          current,
        })),
      };
    }),

    signOut: os.signOut.handler(async ({ context }) => {
      const caller = personOf(context.caller);
      await signIn.signOut(caller.token);
      context.resHeaders?.append('set-cookie', cookie('', 0));
      return { signedOut: true as const };
    }),

    signOutEverywhere: os.signOutEverywhere.handler(async ({ context }) => {
      const caller = personOf(context.caller);
      await signIn.signOutEverywhere(caller.token);
      context.resHeaders?.append('set-cookie', cookie('', 0));
      return { signedOut: true as const };
    }),

    actions: os.actions.handler(async ({ input }) => {
      const { actions, total } = await admin.actionPage(input.editionId, input.page ?? 1);
      return {
        total,
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

    people: os.people.handler(async () => {
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
      const write = writeOf(context.caller, input.reason);
      const announce = (to: string) => mailer.send({ to, ...adminInviteEmail(input.role) });
      done(await admin.invite(input.email, input.role, write, announce), errors);
      return { invited: true as const };
    }),

    setRole: os.setRole.handler(async ({ context, input, errors }) => {
      const write = writeOf(context.caller, input.reason);
      done(await admin.setRole(input.email, input.role, write), errors);
      return { changed: true as const };
    }),

    removePerson: os.removePerson.handler(async ({ context, input, errors }) => {
      const write = writeOf(context.caller, input.reason);
      done(await admin.remove(input.email, write), errors);
      return { removed: true as const };
    }),

    agentTokens: os.agentTokens.handler(async () => {
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
      const write = writeOf(context.caller, input.reason);
      const added = await admin.addAgent(input.name, write);
      if (!added.ok) throw errors.CONFLICT({ data: { refusal: 'name-taken' } });
      return { name: input.name, token: added.token };
    }),

    revokeAgentToken: os.revokeAgentToken.handler(async ({ context, input, errors }) => {
      const write = writeOf(context.caller, input.reason);
      if (!(await admin.revokeAgent(input.name, write))) {
        throw errors.CONFLICT({ data: { refusal: 'unknown' } });
      }
      return { revoked: true as const };
    }),

    // Never logged: reads are not (ADR 0088).
    listAccounts: os.listAccounts.handler(async ({ input }) => {
      const listed = await accounts.list({ page: input.page ?? 1, search: input.search ?? '' });
      return {
        accounts: listed.accounts.map(({ account, signInMethods }) => ({
          id: account.id,
          email: account.email,
          createdAt: account.createdAt.toISOString(),
          signInMethods: [...signInMethods],
        })),
        total: listed.total,
      };
    }),

    // Never logged: reads are not (ADR 0088).
    getAccount: os.getAccount.handler(async ({ input }) => {
      const found = await accounts.get(input.accountId);
      if (found === undefined) return { account: null };
      const { account, signInMethods, editions } = found;
      const entries = await contentQueue.entriesOf(
        editions.flatMap(({ editionId, records }) =>
          records.flatMap(({ key }) => entryIdsOf(key).map((entryId) => ({ editionId, entryId }))),
        ),
      );
      return {
        account: {
          id: account.id,
          email: account.email,
          createdAt: account.createdAt.toISOString(),
          signInMethods: [...signInMethods],
          editions: editions.map(({ editionId, records }) => {
            const named = new Set(records.flatMap(({ key }) => entryIdsOf(key)));
            return {
              editionId,
              records: records.map(({ key, value, changedAt }) => ({
                key,
                value,
                changedAt: changedAt.getTime(),
              })),
              entries: [...named].flatMap((id) => {
                const entry = entries.get(`${editionId} ${id}`);
                return entry === undefined ? [] : [{ id, ...entry }];
              }),
            };
          }),
        },
      };
    }),

    // The app's own deletion path: the Account goes as «Видалити SLOVO ID» deletes it.
    deleteAccount: os.deleteAccount.handler(async ({ context, input, errors }) => {
      const { who, reason } = writeOf(context.caller, input.reason);
      // The Action log keeps the deleted Account's id and email (ADR 0204).
      const deleted = await accounts.deleteByEmail(input.email, ({ id, email, createdAt }) => ({
        who,
        what: 'account.delete',
        before: { id, email, createdAt: createdAt.toISOString() },
        after: null,
        reason,
        editionId: null,
        batchId: null,
      }));
      if (deleted === undefined) throw errors.CONFLICT({ data: { refusal: 'unknown' } });
      return { deleted: true as const };
    }),

    alertThresholds: os.alertThresholds.handler(async () => {
      const values = await alertSettings.thresholds();
      return { thresholds: ALERT_THRESHOLD_KEYS.map((key) => thresholdView(key, values[key])) };
    }),

    setAlertThreshold: os.setAlertThreshold.handler(async ({ context, input }) => {
      const write = writeOf(context.caller, input.reason);
      await alertSettings.set(input.key, input.value, write);
      return { threshold: thresholdView(input.key, input.value) };
    }),

    latestAlerts: os.latestAlerts.handler(async () => {
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

    status: os.status.handler(() => ({ on: true as const })),

    switches: os.switches.handler(async ({ input, errors }) => {
      const switches = await editions.switches(input.editionId);
      if (!switches.ok) throw errors.NOT_FOUND();
      return { states: switches.states, rules: [...switches.rules], minimums: switches.minimums };
    }),

    setRules: os.setRules.handler(async ({ context, input, errors }) => {
      const result = await editions.setRules(input.editionId, input.feature, input.rules, {
        who: actorOf(context.caller),
        reason: input.reason,
      });
      return answered(result, errors);
    }),

    setMinimum: os.setMinimum.handler(async ({ context, input, errors }) => {
      const result = await editions.setMinimum(input.editionId, input.platform, input.minimum, {
        who: actorOf(context.caller),
        reason: input.reason,
      });
      return answered(result, errors);
    }),

    kill: os.kill.handler(async ({ context, input, errors }) => {
      const result = await editions.kill(input.feature, input.editionId, {
        who: actorOf(context.caller),
        reason: input.reason,
      });
      if (!result.ok) {
        throw errors.BAD_REQUEST({ data: { refusal: result.reason, feature: result.feature } });
      }
      return { editionIds: [...result.editionIds] };
    }),

    analytics: os.analytics.handler(async ({ input, errors }) => {
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

    variantResults: os.variantResults.handler(async ({ input, errors }) => {
      const read = await analytics.variants(editionIdsOf(input.editionId, errors), input.feature);
      if (!read.ok) throw errors.ANALYTICS_UNAVAILABLE();
      return { variants: [...read.value], fetchedAt: read.fetchedAt.toISOString() };
    }),

    counters: os.counters.handler(async ({ input, errors }) => {
      const { totals, top, answers } = await analytics.counters(
        editionIdsOf(input.editionId, errors),
      );
      return {
        ...totals,
        top: { known: [...top.known], unknown: [...top.unknown], saved: [...top.saved] },
        answers: [...answers],
      };
    }),

    readerCounts: os.readerCounts.handler(async ({ input, errors }) => {
      return analytics.readers(editionIdsOf(input.editionId, errors), {
        from: input.from,
        to: input.to,
      });
    }),

    editions: os.editions.handler(() => ({
      editions: served.map(({ config }) => ({ id: config.id, displayName: config.displayName })),
    })),

    editionCard: os.editionCard.handler(({ input, errors }) => {
      const edition = served.find(({ config }) => config.id === input.editionId);
      if (edition === undefined) throw errors.NOT_FOUND();
      const {
        id,
        displayName,
        locale,
        categories,
        correctionCategories,
        levels,
        questionnaire,
        onboardingNotificationTimes,
        badges,
        narratorVoices,
      } = edition.config;
      return {
        id,
        displayName,
        locale,
        categories,
        correctionCategories,
        levels,
        questionnaire,
        onboardingNotificationTimes,
        badges: badges.map(({ id: badgeId, name }) => ({ id: badgeId, name })),
        narratorVoices: narratorVoices.voices.map(({ id: voiceId, name }) => ({
          id: voiceId,
          name,
        })),
      };
    }),

    services: servicesProcedures({
      store: services,
      entries: serviceEntries,
      signIn,
      book: serviceMoney,
      usdRates,
      usage: serviceUsage,
    }),

    content: {
      openBatch: content.openBatch.handler(async ({ context, input, errors }) => {
        const writer = actorOf(context.caller);
        const opened = await contentWrites.openBatch(writer, input.editionId);
        if (!opened.ok) throw refusalOf(opened, errors);
        return { batchId: opened.batchId };
      }),
      create: content.create.handler(async ({ context, input, errors }) => {
        const writer = actorOf(context.caller);
        const { fields, ...write } = input;
        const written = await contentWrites.write(writer, {
          ...write,
          change: { op: 'create', fields },
        });
        if (!written.ok) throw refusalOf(written, errors);
        return written.written;
      }),
      edit: content.edit.handler(async ({ context, input, errors }) => {
        const writer = actorOf(context.caller);
        const { id, recordVersion, fields, ...write } = input;
        const written = await contentWrites.write(writer, {
          ...write,
          change: { op: 'edit', id, recordVersion, fields },
        });
        if (!written.ok) throw refusalOf(written, errors);
        return written.written;
      }),
      retire: content.retire.handler(async ({ context, input, errors }) => {
        const writer = actorOf(context.caller);
        const { id, recordVersion, ...write } = input;
        const written = await contentWrites.write(writer, {
          ...write,
          change: { op: 'retire', id, recordVersion },
        });
        if (!written.ok) throw refusalOf(written, errors);
        return written.written;
      }),
      flag: content.flag.handler(async ({ context, input, errors }) => {
        const writer = actorOf(context.caller);
        const flagged = await contentWrites.flag(writer, input);
        if (!flagged.ok) throw refusalOf(flagged, errors);
        return { id: input.id, batchId: input.batchId };
      }),
      report: content.report.handler(async ({ input, errors }) => {
        const reported = await contentWrites.report(input.editionId);
        if (!reported.ok) throw refusalOf(reported, errors);
        const { ok: _ok, ...report } = reported;
        return report;
      }),
      uploadIllustration: content.uploadIllustration.handler(async ({ input, errors }) => {
        const uploaded = await illustrations.upload(
          input.editionId,
          input.id,
          Buffer.from(input.png, 'base64'),
        );
        if (!uploaded.ok) throw refusalOf(uploaded, errors);
        const { ok: _ok, ...answer } = uploaded;
        return answer;
      }),
      record: content.record.handler(async ({ input, errors }) => {
        const found = await contentWrites.record(input.editionId, input.kind, input.id);
        if (!found.ok) throw refusalOf(found, errors);
        const { ok: _ok, ...record } = found;
        if (input.kind !== 'word') return record;
        const illustration = await illustrations.live(input.editionId, input.id);
        return illustration === undefined ? record : { ...record, illustration };
      }),
      records: content.records.handler(async ({ input, errors }) => {
        const { editionId, kind, ...filters } = input;
        const listed = await contentWrites.list(editionId, kind, filters);
        if (!listed.ok) throw refusalOf(listed, errors);
        return { records: listed.records, total: listed.total };
      }),
      unchecked: content.unchecked.handler(async ({ input, errors }) => {
        const found = await contentWrites.unchecked(input.editionId, input.kind, input.skip);
        if (!found.ok) throw refusalOf(found, errors);
        const { ok: _ok, ...answer } = found;
        return answer;
      }),
      check: content.check.handler(async ({ context, input, errors }) => {
        // Only a person checks a record; an Агент's eye is not a check.
        const writer = personOf(context.caller);
        const checked = await contentWrites.check(writer.email, input);
        if (!checked.ok) throw refusalOf(checked, errors);
        return checked.checked;
      }),
      checkAll: content.checkAll.handler(async ({ context, input, errors }) => {
        // Only a person checks a record; an Агент's eye is not a check.
        const writer = personOf(context.caller);
        const checked = await contentWrites.checkAll(writer.email, input);
        if (checked.ok) return { checked: checked.checked };
        if (checked.reason === 'changed') throw errors.CHANGED({ data: { total: checked.total } });
        throw refusalOf(checked, errors);
      }),
      addOtherVoices: content.addOtherVoices.handler(async ({ context, input, errors }) => {
        // Only an Admin user asks for the other voices; an Агент is refused (ADR 0195).
        const writer = personOf(context.caller);
        const added = await contentWrites.addOtherVoices(writer.email, input);
        if (added.ok) return { id: added.id };
        if (added.reason === 'not-live' || added.reason === 'listed') {
          throw errors.NOT_ADDABLE({ data: { reason: added.reason } });
        }
        throw refusalOf(added, errors);
      }),
    },
    contentQueue: {
      batches: queue.batches.handler(async ({ input }) => {
        return { batches: await contentQueue.batches(input.editionId) };
      }),
      review: queue.review.handler(async ({ context, input, errors }) => {
        const { email } = personOf(context.caller);
        const reviewed = await contentQueue.review(email, input.batchId, input.reason);
        if (!reviewed.ok) throw errors.NOT_FOUND();
        return { reviewed: true as const };
      }),
      rollback: queue.rollback.handler(async ({ context, input, errors }) => {
        const { email } = personOf(context.caller);
        const rolledBack = await contentQueue.rollback(email, input.batchId, input.reason);
        if (!rolledBack.ok) throw errors.NOT_FOUND();
        const { ok: _ok, ...answer } = rolledBack;
        return answer;
      }),
      flags: queue.flags.handler(async ({ input }) => {
        return { flags: await contentQueue.flags(input.editionId) };
      }),
      resolveFlag: queue.resolveFlag.handler(async ({ context, input, errors }) => {
        const { email } = personOf(context.caller);
        const resolved = await contentQueue.resolveFlag(
          email,
          input.id,
          input.decision,
          input.reason,
        );
        if (!resolved.ok) throw errors.NOT_FOUND();
        return { resolved: true as const };
      }),
      reports: queue.reports.handler(async ({ input }) => {
        return { reports: await contentQueue.reports(input.editionId) };
      }),
      resolveReport: queue.resolveReport.handler(async ({ context, input, errors }) => {
        const { email } = personOf(context.caller);
        const resolved = await contentQueue.resolveReport(email, input.id, input.reason);
        if (!resolved.ok) throw errors.NOT_FOUND();
        return { resolved: true as const };
      }),
    },
    development: os.development.handler(async () => {
      return development.overview();
    }),

    ownerChecks: os.ownerChecks.handler(async ({ input }) => {
      const checks = await ownerChecks.list(input.version);
      const open: Record<string, number> = {};
      for (const check of checks) {
        open[check.version] = (open[check.version] ?? 0) + (check.ticked === null ? 1 : 0);
      }
      return { checks: checks.map(ownerCheckView), open };
    }),

    tickOwnerCheck: os.tickOwnerCheck.handler(async ({ context, input, errors }) => {
      if ((await ownerChecks.tick(input.id, actorOf(context.caller))) === 'unknown') {
        throw errors.NOT_FOUND();
      }
      const check = (await ownerChecks.list()).find(({ id }) => id === input.id);
      if (!check) throw errors.NOT_FOUND();
      return { check: ownerCheckView(check) };
    }),

    addOwnerCheck: os.addOwnerCheck.handler(async ({ context, input }) => {
      const check = await ownerChecks.add(input.version, input.text, actorOf(context.caller));
      return { check: ownerCheckView(check) };
    }),

    quality: os.quality.handler(async ({ input }) => {
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

    ciHistory: os.ciHistory.handler(async ({ input }) => {
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
    pushCiRun: os.pushCiRun.handler(async ({ input }) => {
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
