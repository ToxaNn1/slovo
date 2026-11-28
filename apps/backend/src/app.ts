import { CollectionLinkIdSchema, type AppConfig } from '@slovo/contracts';
import {
  createAccounts,
  createAdminAccess,
  createServiceEntries,
  createAlertSettings,
  createOwnerChecks,
  createAdminSignIn,
  createQuality,
  createServiceUsage,
  createCollectionLinks,
  createAdminAnalytics,
  createCommunityCounters,
  createDevelopment,
  createMistakeReports,
  createSync,
  createServiceMoneyBook,
  createUsdRates,
  type Alerts,
  type AppleRevoker,
  type AppleVerifier,
  type Clock,
  type EasSource,
  type Edition,
  type GitHubSource,
  type GoogleVerifier,
  type Mailer,
  type PostHogPort,
  type NbuPort,
  type Random,
  type SentryReader,
  type UsagePort,
  type ServiceVault,
} from '@slovo/server-core';
import { createHash, timingSafeEqual } from 'node:crypto';
import { BlockList, isIPv4, isIPv6 } from 'node:net';

import type { HttpBindings } from '@hono/node-server';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';

import { createIllustrations } from './content/illustrations';
import type { MediaStore } from './media/media-store';
import { requestId, type RequestIdVariables } from 'hono/request-id';
import type { Logger } from 'pino';

import { createAuthenticator } from './account/authenticator';
import { adminApp, privateApiHeaders } from './admin/admin-app';
import { adminCodeEmail } from './admin/admin-mail';
import { createAdminStore, createSecretVault, hashToken, hmacSha1 } from './admin/admin-store';
import { createContentStore } from './content/content-store';
import { createContentQueue } from './content/content-queue';
import { createContentWrites } from './content/content-writes';
import { createOwnerCheckStore } from './admin/owner-check-store';
import { createServiceEntryStore } from './services/service-entry-store';
import { createServiceMoneyStore } from './services/service-money-store';
import { createUsdRateStore } from './services/usd-rate-store';
import { createServiceStore } from './services/service-store';
import { createCiRunStore } from './quality/ci-run-store';
import { createAlertStore, createAlertThresholdStore } from './alerts/alert-store';
import { createApiHandler, INTERNAL_FAILURE, onUnexpectedFailure } from './api';
import {
  APP_SITE_ASSOCIATION_PATH,
  appSiteAssociation,
} from './collection-links/app-site-association';
import { createCollectionLinkStore } from './collection-links/collection-link-store';
import { collectionPage, unavailablePage } from './collection-links/collection-page';
import { createCounterStore } from './counters/counter-store';
import type { Database } from './database/database';
import { migrationState, type MigrationState } from './database/migrate';
import type { ErrorReporter } from './error-reporter';
import { createEditions } from './edition/editions';
import { createRateLimits } from './rate-limits';
import { createMistakeReportStore } from './reports/mistake-report-store';
import { createUserRecords } from './sync/user-records';

/**
 * The largest request body the API reads; it refuses a larger one before
 * parsing it. The largest request is a push of 500 changes, each a key of 200
 * characters and a value of 8 KB of JSON (ADR 0041): 4.7 MB at most, when
 * every character of its keys takes six bytes of JSON (`\u0001`).
 */
const MAX_BODY_BYTES = 8 * 1024 * 1024;

/** What the backend is built from. A test gives its own. */
export interface AppDependencies {
  readonly database: Database;
  readonly clock: Clock;
  /** Where the ids of new Collection Links come from. */
  readonly random: Random;
  readonly logger: Logger;
  /** The identity of the one app (ADR 0065), read from the AppConfig at start. */
  readonly app: AppConfig;
  /** Every Edition the backend serves, read from the Edition folders at start. */
  readonly editions: readonly Edition[];
  /** Sends the sign-in emails. */
  readonly mailer: Mailer;
  /** Tells the owner of a Kill switch. */
  readonly alerts: Alerts;
  /** Reads the aggregates of the Analytics events, for the admin's Аналітика. */
  readonly posthog: PostHogPort;
  /** The NBU's official rate of the dollar, for «Сервіси»'s money in hryvnias. */
  readonly nbu: NbuPort;
  /** Verifies the Google identity tokens of Google sign-ins. */
  readonly google: GoogleVerifier;
  /** Verifies the Apple identity tokens of Apple sign-ins, for the app's bundle id. */
  readonly apple: AppleVerifier;
  /** Revokes SLOVO at Apple when an Account with Sign in with Apple is deleted. */
  readonly appleRevoker: AppleRevoker;
  /** The repository on GitHub, read for Розробка. */
  readonly github: GitHubSource;
  /** The app's builds on EAS, read for Розробка. */
  readonly eas: EasSource;
  /** Signs the Sessions' tokens. */
  readonly authSecret: string;
  /** Where the unexpected failures (500) are reported. */
  readonly reporter: ErrorReporter;
  /**
   * How many proxies in front of the backend append to `X-Forwarded-For`,
   * whose addresses it trusts: 0 when nothing is in front of it.
   */
  readonly trustedProxyHops: number;
  /**
   * The value of the `X-Slovo-Edge-Secret` header the app's own Cloudflare
   * zone sets on every request; with two hops and this set, only a request
   * that carries it has its client trusted. Unset trusts any Cloudflare hop.
   */
  readonly edgeSecret: string | undefined;
  /** Where Якість reads Sentry's numbers. */
  readonly sentry: SentryReader;
  /** Where «Сервіси» reads each Service's usage, by the Service's name. */
  readonly usage: Readonly<Record<string, UsagePort>>;
  /** The Bearer token CI pushes its history with; unset refuses every push. */
  readonly ciToken: string | undefined;
  /** The URL root of the Media Store the snapshot and the Patch name (ADR 0099). */
  readonly mediaBase: string;
  /** The Media Store the content editor keeps Illustrations in (ADR 0099). */
  readonly mediaStore: MediaStore;
  /** The folder of the built owner admin app (apps/admin/dist), served at `/admin`; without it none. */
  readonly adminDist?: string | undefined;
  /** The Vault of the Service entries, under `VAULT_KEY`, or off without it. */
  readonly vault: ServiceVault;
}

type Variables = RequestIdVariables & {
  logger: Logger;
  /** The IP address of the request's connection. */
  ip: string;
};

/** What the backend's Hono app knows of a request: Node's HTTP bindings and its own variables. */
interface Env {
  Bindings: HttpBindings;
  Variables: Variables;
}

/**
 * Cloudflare's published ranges (cloudflare.com/ips, read 21.11.2026): the
 * addresses Railway's proxy sees when a request came through Cloudflare.
 */
const CLOUDFLARE = (() => {
  const ranges = new BlockList();
  for (const range of [
    '173.245.48.0/20',
    '103.21.244.0/22',
    '103.22.200.0/22',
    '103.31.4.0/22',
    '141.101.64.0/18',
    '108.162.192.0/18',
    '190.93.240.0/20',
    '188.114.96.0/20',
    '197.234.240.0/22',
    '198.41.128.0/17',
    '162.158.0.0/15',
    '104.16.0.0/13',
    '104.24.0.0/14',
    '172.64.0.0/13',
    '131.0.72.0/22',
  ]) {
    const [network = '', prefix] = range.split('/');
    ranges.addSubnet(network, Number(prefix), 'ipv4');
  }
  for (const range of [
    '2400:cb00::/32',
    '2606:4700::/32',
    '2803:f800::/32',
    '2405:b500::/32',
    '2405:8100::/32',
    '2a06:98c0::/29',
    '2c0f:f248::/32',
  ]) {
    const [network = '', prefix] = range.split('/');
    ranges.addSubnet(network, Number(prefix), 'ipv6');
  }
  return ranges;
})();

/** Whether an address, an IPv4-mapped IPv6 one included, is Cloudflare's. */
function isCloudflare(address: string): boolean {
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address)?.[1];
  const v4 = mapped ?? address;
  if (isIPv4(v4)) return CLOUDFLARE.check(v4, 'ipv4');
  return isIPv6(address) && CLOUDFLARE.check(address, 'ipv6');
}

/** The header the app's own Cloudflare zone sets, with `edgeSecret` as its value. */
const EDGE_SECRET_HEADER = 'x-slovo-edge-secret';

const digest = (value: string) => createHash('sha256').update(value).digest();

/** Whether the request carries the zone's secret, compared in constant time. */
function fromOwnZone(given: string | undefined, edgeSecret: string | undefined): boolean {
  if (edgeSecret === undefined) return true;
  return given !== undefined && timingSafeEqual(digest(given), digest(edgeSecret));
}

/**
 * The IP address the request came from (ADR 0030). With no trusted proxy
 * hop, the address of its connection. Behind Railway's proxy, the last
 * address of `X-Forwarded-For`, the one that proxy appended; whatever stands
 * before it, the client wrote itself. With two hops, Cloudflare in front,
 * the address before the last counts only when the last is Cloudflare's:
 * a request sent straight to Railway's domain has its caller last, and the
 * forged address before it is ignored. Any Cloudflare zone or Worker can send
 * from Cloudflare's addresses, so with `edgeSecret` set the address before
 * the last counts only when the request also carries the header the app's
 * own zone sets; else Cloudflare's hop counts. A header with no address did
 * not come through the proxy, so its connection counts. Node gives every
 * request its connection; a request made in process without one has none.
 */
function clientIp(
  bindings: Partial<HttpBindings> | undefined,
  forwardedFor: string | undefined,
  trustedProxyHops: number,
  edge: { readonly given: string | undefined; readonly secret: string | undefined },
): string | undefined {
  const connection = bindings?.incoming?.socket.remoteAddress;
  if (trustedProxyHops === 0 || forwardedFor === undefined) return connection;
  const forwarded = forwardedFor
    .split(',')
    .map((address) => address.trim())
    .filter((address) => address !== '');
  const last = forwarded.at(-1);
  if (last === undefined) return connection;
  if (trustedProxyHops === 1 || !isCloudflare(last)) return last;
  if (!fromOwnZone(edge.given, edge.secret)) return last;
  return forwarded.at(-2) ?? last;
}

/**
 * The composition root: builds the whole backend from the dependencies it is
 * given. `main.ts` gives the real ones; a test gives its own.
 */
export function createApp({
  database,
  clock,
  random,
  logger,
  app: appConfig,
  editions,
  mailer,
  alerts,
  posthog,
  nbu,
  google,
  apple,
  appleRevoker,
  github,
  eas,
  authSecret,
  reporter,
  trustedProxyHops,
  edgeSecret,
  adminDist,
  sentry,
  usage,
  ciToken,
  mediaBase,
  mediaStore,
  vault,
}: AppDependencies) {
  const editionRegistry = createEditions({ database, clock, editions, alerts });
  const rateLimits = createRateLimits(database, { secret: authSecret });
  const userRecords = createUserRecords(database);
  const authenticator = createAuthenticator(database, { secret: authSecret, logger });
  const accounts = createAccounts({
    editions: editionRegistry,
    authenticator,
    google,
    apple,
    appleRevoker,
    bundleId: appConfig.bundleId,
    mailer,
    rateLimits,
    records: userRecords,
    clock,
  });
  const contentStore = createContentStore({ database, clock, editions: editionRegistry });
  const sync = createSync({
    editions: editionRegistry,
    records: userRecords,
    rateLimits,
    clock,
  });
  const mistakeReports = createMistakeReports({
    editions: editionRegistry,
    store: createMistakeReportStore(database),
    rateLimits,
    clock,
  });
  const counterStore = createCounterStore(database);
  const communityCounters = createCommunityCounters({
    editions: editionRegistry,
    store: counterStore,
    rateLimits,
    clock,
  });
  const collectionLinks = createCollectionLinks({
    editions: editionRegistry,
    store: createCollectionLinkStore(database),
    rateLimits,
    clock,
    random,
    domain: appConfig.domain,
  });
  const adminStore = createAdminStore(database);
  const admin = createAdminAccess({ store: adminStore, clock, random, hash: hashToken });
  // The admin's own sign-in: only the mailer and the limits' table are shared
  // with the Account's (ADR 0088).
  const adminSignIn = createAdminSignIn({
    store: adminStore,
    clock,
    random,
    hash: hashToken,
    mailer,
    rateLimits,
    hmacSha1,
    vault: createSecretVault(authSecret),
    codeEmail: adminCodeEmail,
    onCodeNotSent: (error) => {
      logger.error({ err: error }, 'admin sign-in code not sent');
    },
  });
  const adminAnalytics = createAdminAnalytics({
    posthog,
    counters: counterStore,
    accounts: authenticator,
    records: userRecords,
    clock,
    wait: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  });
  const contentWrites = createContentWrites({ database, clock, random, editions: editionRegistry });
  const api = createApiHandler({
    accounts,
    admin,
    adminAnalytics,
    adminSignIn,
    clock,
    collectionLinks,
    communityCounters,
    contentQueue: createContentQueue({ database, clock }),
    contentStore,
    contentWrites,
    illustrations: createIllustrations({
      database,
      clock,
      editions: editionRegistry,
      mediaStore,
      mediaBase,
    }),
    development: createDevelopment({ github, eas, clock }),
    mediaBase,
    editions: editionRegistry,
    mailer,
    mistakeReports,
    ownerChecks: createOwnerChecks({ store: createOwnerCheckStore(database), clock, admin }),
    quality: {
      quality: createQuality({ sentry, ciRuns: createCiRunStore(database), clock }),
      ciToken,
      alertSettings: createAlertSettings({ store: createAlertThresholdStore(database), admin }),
      alertStore: createAlertStore(database),
    },
    served: editions,
    services: createServiceStore(database),
    serviceEntries: createServiceEntries({
      store: createServiceEntryStore(database),
      vault,
      admin,
      clock,
    }),
    serviceMoney: createServiceMoneyBook({
      services: createServiceStore(database),
      store: createServiceMoneyStore(database),
      clock,
      admin,
    }),
    serviceUsage: createServiceUsage({ ports: usage, clock }),
    usdRates: createUsdRates({ nbu, store: createUsdRateStore(database, clock), clock }),
    sync,
  });

  const app = new Hono<Env>();

  // Takes the request's x-request-id, or makes one, and sends it back.
  app.use(requestId({ headerName: 'x-request-id' }));
  // Every log line of a request carries its id; one line sums it up.
  app.use(async (c, next) => {
    const started = clock.now().getTime();
    const requestLogger = logger.child({ requestId: c.var.requestId });
    c.set('logger', requestLogger);
    await next();
    requestLogger.info(
      {
        method: c.req.method,
        path: c.req.path,
        status: c.res.status,
        ms: clock.now().getTime() - started,
      },
      'request',
    );
  });

  // Every request has the IP address of its client, which the limits per IP
  // count (ADR 0030); one without is a broken invariant.
  app.use(async (c, next) => {
    const ip = clientIp(c.env, c.req.header('x-forwarded-for'), trustedProxyHops, {
      given: c.req.header(EDGE_SECRET_HEADER),
      secret: edgeSecret,
    });
    if (ip === undefined) throw new Error('the request came on no connection');
    c.set('ip', ip);
    await next();
  });

  // For a host to tell a sick server: 503 while the database doesn't answer
  // or hasn't run every migration. It names the last migration run, nothing else.
  app.get('/health', async (c) => {
    let state: MigrationState;
    try {
      await database.ping();
      state = await migrationState(database);
    } catch (error) {
      c.var.logger.warn({ err: error }, 'the database does not answer');
      return c.json({ status: 'unavailable' }, 503);
    }
    if (state.status === 'pending') {
      return c.json({ status: 'migrations pending', migration: state.last }, 503);
    }
    return c.json({ status: 'ok', migration: state.last });
  });

  // The file that lets the app open its Collection Links.
  // While the app has no Team ID there is none, so the path is not found.
  const association = appSiteAssociation(
    appConfig,
    editions.map(({ config }) => config.id),
  );
  if (association !== undefined) {
    app.get(APP_SITE_ASSOCIATION_PATH, (c) => c.json(association));
  }

  // A body too large to be a request of the API is refused before it is
  // parsed and before any Session is checked: at once when its Content-Length
  // says so, else once it has come past the limit.
  app.use(
    '/v1/*',
    bodyLimit({
      maxSize: MAX_BODY_BYTES,
      onError: (c) => c.json({ code: 'PAYLOAD_TOO_LARGE' }, 413),
    }),
  );

  /** The API's answer to the request, with what the backend knows of the request it came in. */
  const handleApi = (request: Request, { logger, requestId, ip }: Variables) =>
    api.handle(request, {
      context: { logger, requestId, reporter, headers: request.headers, ip },
    });

  for (const path of ['/v1/admin/*', '/v1/editions/:editionId/records']) {
    app.use(path, ...privateApiHeaders);
  }

  // The API contract at `/v1`, its description at `/docs`.
  for (const path of ['/v1/*', '/docs', '/docs/*']) {
    app.use(path, async (c, next) => {
      const { matched, response } = await handleApi(c.req.raw, c.var);
      if (matched) return c.newResponse(response.body, response);
      return next();
    });
  }

  // A Collection Link as its URL names it, under its Edition's path (ADR 0065): a browser gets its web page; any other client the API's
  // answer for the link. Like the API's read, it is not limited. The page
  // speaks the language of the Edition the path names; a link of another
  // Edition is unavailable there.
  app.get('/:edition/c/:id', async (c) => {
    const id = c.req.param('id');
    const edition = editions.find(({ config }) => config.id === c.req.param('edition'));
    if (edition === undefined) return c.notFound();
    const wellFormed = CollectionLinkIdSchema.safeParse(id).success;
    const found = wellFormed ? await collectionLinks.read(id) : undefined;
    const here = found?.ok === true && found.link.edition === edition.config.id;
    if (!(c.req.header('accept') ?? '').includes('text/html')) {
      if (found?.ok === true && !here) return c.notFound();
      const url = new URL(`/v1/collection-links/${encodeURIComponent(id)}`, c.req.url);
      const { response } = await handleApi(new Request(url, c.req.raw), c.var);
      return response === undefined ? c.notFound() : c.newResponse(response.body, response);
    }
    if (!wellFormed) return c.html(unavailablePage(edition), 400);
    if (found?.ok !== true || !here) return c.html(unavailablePage(edition), 404);
    const entries = await contentStore.entries(found.link.edition, found.link.entryIds);
    return c.html(collectionPage(edition, appConfig.scheme, id, found.link, entries));
  });

  // The owner admin app (ADR 0088), off (404) while no Власник exists.
  if (adminDist !== undefined) {
    app.route('/admin', adminApp({ dist: adminDist, isOn: () => admin.isOn() }));
  }

  // An address the backend doesn't serve, under `/v1` too.
  app.notFound((c) => c.json({ code: 'NOT_FOUND' }, 404));

  // The one global handler of what the API's own handler doesn't catch.
  app.onError((error, c) => {
    onUnexpectedFailure({ logger: c.var.logger, requestId: c.var.requestId, reporter }, error);
    return c.json(INTERNAL_FAILURE, 500);
  });

  return app;
}

export type App = ReturnType<typeof createApp>;
