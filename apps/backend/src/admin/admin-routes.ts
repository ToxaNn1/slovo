import { FeatureSwitchesSchema, type AppConfig } from '@slovo/contracts';
import type { Accounts, Edition, EditionRegistry } from '@slovo/server-core';
import { count, desc, sql, sum } from 'drizzle-orm';
import { Hono, type Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { html } from 'hono/html';
import type { HtmlEscapedString } from 'hono/utils/html';

import type { Database } from '../database/database';
import {
  accounts as accountRows,
  communityCounters,
  mistakeReports,
  questionnaireCounters,
} from '../database/schema';
import { resolveReport } from '../reports/report-resolve';

/** The cookie that carries the owner's Session token, on the admin's paths alone. */
const COOKIE = 'slovo_admin';

const FeatureSchema = FeatureSwitchesSchema.keyof();
const FEATURES = FeatureSchema.options;

const POSTHOG_URL = 'https://eu.posthog.com';

/** App Store Connect at the app, or at the list of apps while the app has no id. */
const appStoreConnectUrl = ({ appStoreConnectAppId }: AppConfig) =>
  `https://appstoreconnect.apple.com/apps${appStoreConnectAppId === '' ? '' : `/${appStoreConnectAppId}`}`;

const page = (body: HtmlEscapedString | Promise<HtmlEscapedString>) =>
  html`<!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex" />
        <title>SLOVO admin</title>
      </head>
      <body>
        ${body}
      </body>
    </html>`;

const emailForm = html`<form method="post" action="/admin/code">
  <label>Email <input type="email" name="email" required /></label>
  <button>Send a Sign-in code</button>
</form>`;

/**
 * The owner admin (ADR 0069): web pages at `/admin` that only the owner's
 * Account signs in to, with the remote Feature Switches of each Edition, a
 * summary of the counts the backend keeps and the Mistake Report inbox.
 * Every page and form refuses any Session but the owner's.
 */
export function adminRoutes({
  database,
  accounts,
  editions,
  served,
  app,
  ownerEmail,
}: {
  database: Database;
  accounts: Accounts;
  editions: EditionRegistry;
  served: readonly Edition[];
  app: AppConfig;
  ownerEmail: string;
}) {
  const owner = ownerEmail.trim().toLowerCase();
  const isOwner = (email: string) => email.trim().toLowerCase() === owner;
  // The Sign-in code comes in the language of the default Edition, or of the
  // first Edition the backend serves when it doesn't serve that one.
  const mailEdition = served.some(({ config }) => config.id === app.defaultEdition)
    ? app.defaultEdition
    : (served[0]?.config.id ?? app.defaultEdition);
  const { db } = database;
  const admin = new Hono<{ Variables: { ip: string } }>();

  const refused = (c: Context, status: 400 | 401 | 403, reason: string) =>
    c.html(
      page(
        html`<p>${reason}</p>
          ${status === 400 ? '' : emailForm}`,
      ),
      status,
    );

  /** The owner's Session the cookie carries, or the answer that refuses the request. */
  async function ownerSession(c: Context) {
    const opened = await accounts.session(getCookie(c, COOKIE));
    if (!opened.ok) return { ok: false, answer: refused(c, 401, 'Sign in as the owner.') } as const;
    if (!isOwner(opened.session.account.email)) {
      return { ok: false, answer: refused(c, 403, 'Only the owner signs in here.') } as const;
    }
    return { ok: true, session: opened.session } as const;
  }

  const field = async (c: Context, name: string) => {
    const value = (await c.req.parseBody())[name];
    return typeof value === 'string' ? value : '';
  };

  admin.post('/code', async (c) => {
    const email = await field(c, 'email');
    if (!isOwner(email)) return refused(c, 403, 'Only the owner signs in here.');
    const sent = await accounts.requestCode(email, mailEdition, c.var.ip);
    if (!sent.ok) return refused(c, 400, `No code sent: ${sent.reason}.`);
    return c.html(
      page(
        html`<form method="post" action="/admin/sign-in">
          <input type="hidden" name="email" value="${email}" />
          <label>Sign-in code <input name="code" inputmode="numeric" required /></label>
          <button>Sign in</button>
        </form>`,
      ),
    );
  });

  admin.post('/sign-in', async (c) => {
    const email = await field(c, 'email');
    if (!isOwner(email)) return refused(c, 403, 'Only the owner signs in here.');
    const checked = await accounts.verifyCode(email, await field(c, 'code'), c.var.ip);
    if (!checked.ok) return refused(c, 401, `Not signed in: ${checked.reason}.`);
    setCookie(c, COOKIE, checked.token, {
      path: '/admin',
      httpOnly: true,
      secure: true,
      sameSite: 'Strict',
    });
    return c.redirect('/admin', 303);
  });

  admin.post('/sign-out', async (c) => {
    const signedIn = await ownerSession(c);
    if (signedIn.ok) await accounts.signOut(signedIn.session);
    deleteCookie(c, COOKIE, { path: '/admin' });
    return c.redirect('/admin', 303);
  });

  // A remote switch only turns a feature off, or clears that (ADR 0040); a
  // feature the Edition has off stays off, so it has nothing to clear.
  admin.post('/switches', async (c) => {
    const signedIn = await ownerSession(c);
    if (!signedIn.ok) return signedIn.answer;
    const [editionId, feature, action] = await Promise.all(
      ['edition', 'feature', 'action'].map((name) => field(c, name)),
    );
    if (action !== 'off' && action !== 'clear') {
      return refused(c, 400, 'A remote switch only turns a feature off or clears that.');
    }
    const shipped = editions.find(editionId ?? '')?.config.featureSwitches;
    const known = FeatureSchema.safeParse(feature);
    if (action === 'clear' && known.success && shipped?.[known.data] === false) {
      return refused(c, 400, 'The Edition has the feature off; a remote switch never turns it on.');
    }
    const set =
      action === 'off'
        ? await editions.switchOff(editionId ?? '', feature ?? '')
        : await editions.clearSwitch(editionId ?? '', feature ?? '');
    if (!set.ok) return refused(c, 400, `Not set: ${set.reason}.`);
    return c.redirect('/admin', 303);
  });

  admin.post('/reports/resolve', async (c) => {
    const signedIn = await ownerSession(c);
    if (!signedIn.ok) return signedIn.answer;
    const resolved = await resolveReport(database, await field(c, 'id'));
    if (resolved.exitCode !== 0) return refused(c, 400, resolved.line);
    return c.redirect('/admin', 303);
  });

  admin.get('/', async (c) => {
    const signedIn = await ownerSession(c);
    if (!signedIn.ok) return signedIn.answer;
    const [accountCount, counters, answers, reports, switches] = await Promise.all([
      db.select({ n: count() }).from(accountRows),
      db
        .select({
          editionId: communityCounters.editionId,
          entries: count(),
          known: sum(communityCounters.known),
          unknown: sum(communityCounters.unknown),
          saved: sum(communityCounters.saved),
        })
        .from(communityCounters)
        .groupBy(communityCounters.editionId)
        .orderBy(communityCounters.editionId),
      db
        .select()
        .from(questionnaireCounters)
        .orderBy(
          questionnaireCounters.editionId,
          questionnaireCounters.question,
          sql`${questionnaireCounters.count} desc`,
        ),
      db
        .select()
        .from(mistakeReports)
        .orderBy(desc(mistakeReports.receivedAt), desc(mistakeReports.id)),
      Promise.all(
        served.map(async (edition) => {
          const remote = await editions.remoteSwitches(edition.config.id);
          return { edition, off: remote.ok ? remote.off : [] };
        }),
      ),
    ]);
    return c.html(
      page(
        html`<h1>SLOVO admin</h1>
          <form method="post" action="/admin/sign-out"><button>Sign out</button></form>

          <h2>Summary</h2>
          <p>Accounts: ${accountCount[0]?.n ?? 0}</p>
          <p>
            <a href="${POSTHOG_URL}">PostHog</a> ·
            <a href="${appStoreConnectUrl(app)}">App Store Connect</a>
          </p>
          <h3>Community Counters</h3>
          <table>
            <tr>
              <th>Edition</th>
              <th>Entries</th>
              <th>Known</th>
              <th>Unknown</th>
              <th>Saved</th>
            </tr>
            ${counters.map(
              (row) =>
                html`<tr>
                  <td>${row.editionId}</td>
                  <td>${row.entries}</td>
                  <td>${row.known ?? 0}</td>
                  <td>${row.unknown ?? 0}</td>
                  <td>${row.saved ?? 0}</td>
                </tr>`,
            )}
          </table>
          <h3>Questionnaire counters</h3>
          <table>
            <tr>
              <th>Edition</th>
              <th>Question</th>
              <th>Answer</th>
              <th>Readers</th>
            </tr>
            ${answers.map(
              (row) =>
                html`<tr>
                  <td>${row.editionId}</td>
                  <td>${row.question}</td>
                  <td>${row.answer}</td>
                  <td>${row.count}</td>
                </tr>`,
            )}
          </table>

          <h2>Mistake Reports</h2>
          ${reports.length === 0 ? html`<p>No Mistake Reports to check.</p>` : ''}
          <table>
            ${reports.map(
              (report) =>
                html`<tr>
                  <td>${report.receivedAt.toISOString()}</td>
                  <td>${report.editionId}</td>
                  <td>${report.entryId}</td>
                  <td>${report.type}</td>
                  <td>${report.comment}</td>
                  <td>app ${report.appVersion}, content ${report.contentVersion}</td>
                  <td>
                    <form method="post" action="/admin/reports/resolve">
                      <input type="hidden" name="id" value="${report.id}" />
                      <button>Resolve</button>
                    </form>
                  </td>
                </tr>`,
            )}
          </table>

          <h2>Remote Feature Switches</h2>
          ${switches.map(
            ({ edition, off }) =>
              html`<h3>${edition.config.id}</h3>
                <table>
                  ${FEATURES.map((feature) => {
                    const control = !edition.config.featureSwitches[feature]
                      ? 'off in the Edition'
                      : html`<form method="post" action="/admin/switches">
                          <input type="hidden" name="edition" value="${edition.config.id}" />
                          <input type="hidden" name="feature" value="${feature}" />
                          ${
                            off.includes(feature)
                              ? html`<input type="hidden" name="action" value="clear" />
                                  <button>off remotely: clear</button>`
                              : html`<input type="hidden" name="action" value="off" />
                                  <button>on: turn off</button>`
                          }
                        </form>`;
                    return html`<tr>
                      <td>${feature}</td>
                      <td>${control}</td>
                    </tr>`;
                  })}
                </table>`,
          )}`,
      ),
    );
  });

  return admin;
}
