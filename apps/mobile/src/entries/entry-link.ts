import { CollectionLinkIdSchema } from '@slovo/contracts';

import { EDITION_PARAM } from '../edition/edition-link';
import { isFromNotification } from '../notifications/notification-scheduler';
import { APP_INTENT_PARAM, APP_INTENT_ROUTES, APP_INTENTS, type AppIntent } from './app-intents';

/** Where outside the app an Entry link opened from: a notification or the home-screen widget. */
export type OpenedFrom = 'notification' | 'widget';

/** The value of the search param `from` that marks an Entry link as the widget's. */
const widgetSource = 'widget';

/** The search the outside links keep on the widget's link to an Entry, and on no other link. */
const widgetSearch = `?from=${widgetSource}`;

/**
 * Where outside the app the search params of an Entry link say it opened
 * from, or nothing for a link from inside the app. The widget's link is the
 * Edition's scheme + `entry/<id>?from=widget&key=<link key>`; by the time the
 * Entry route reads it, the outside links have checked its key and dropped it
 * (`createOutsideLinks`).
 */
export function openedFromOf(params: { readonly from?: string }): OpenedFrom | undefined {
  if (isFromNotification(params)) return 'notification';
  if (params.from === widgetSource) return 'widget';
  return undefined;
}

/** The path of an Entry opened from a link, `/entry/<id>`, the only one the widget's mark opens. */
const linkEntryPath = /^\/entry\/[^/]+$/;

/**
 * The path of an Entry on any of its routes: from a link, the Game, Favorites,
 * History, Learning or a Collection.
 */
const entryPath =
  /^\/(?:entry|game|saved\/(?:favorites|history|learning)|saved\/collections\/[^/]+)\/[^/]+$/;

/** A path under `/c`, where a Collection Link opens as `/c/<id>` (ADR 0058). */
const collectionLinksPath = /^\/c(?:\/|$)/;

/** A link's scheme, such as `slovo-uk://`, after which its host is the first part of the path. */
const schemePrefix = /^[a-z][a-z0-9+.-]*:\/\//i;

/** The origin of a web address, with its host, which Expo Router leaves out of the path it opens. */
const webOrigin = /^https?:\/\/([^/?#]*)/i;

/** The path and search of the route a link opens. */
interface Route {
  readonly path: string;
  readonly search: string;
}

/**
 * The route a link opens, as Expo Router reads it: after the scheme or the
 * origin `https://<linkDomain>`, in any letter case, or, for the dev client's
 * link (`<scheme>://expo-development-client/?url=<link>`), that of the link in
 * its `url`. Nothing for a web address of any other host, which the app never
 * opens (ADR 0058).
 */
function routeOf(link: string, linkDomain: string): Route | undefined {
  const host = webOrigin.exec(link)?.[1];
  if (host !== undefined && host.toLowerCase() !== linkDomain.toLowerCase()) return undefined;
  const [location = '', search = ''] = link.replace(webOrigin, '').replace(/#.*$/, '').split('?');
  const rest = location.replace(schemePrefix, '');
  if (schemePrefix.test(location) && /^expo-development-client\/?$/.test(rest)) {
    const inner = new URLSearchParams(search).get('url') ?? '';
    return routeOf(inner, linkDomain);
  }
  return { path: `/${rest.replace(/^\/+/, '')}`, search };
}

/** A path with each run of `/` made one and no `/` at its end, as Expo Router matches it. */
function normalPath(path: string): string {
  return path.replace(/\/{2,}/g, '/').replace(/(.)\/$/, '$1');
}

/**
 * The path a link from outside the app opens, such as a link another app or
 * a web page opens with the Edition's scheme, or nothing for a link the app
 * ignores. A Collection Link, `https://<linkDomain>/c/<id>` (the only web
 * address iOS hands the app; one of any other host opens nothing) or the
 * scheme + `c/<id>`, opens `/c/<id>` with
 * none of its search params; any other link under `c/`, with an id the
 * backend never makes, opens nothing (ADR 0058). A link to an Entry, on any of
 * its routes and whatever its slashes, opens with its path and none of its
 * search params, so it can't name the label of «Назад» or pass for a
 * notification's link, which never comes from outside (`NotificationTaps`
 * opens it inside the app). Only the widget's link keeps its mark, only to
 * `/entry/<id>` and only with the key of the Widget Snapshot the widget reads
 * now, which an app or a web page can't read; any other is a plain link, so
 * its Entry is not Seen and goes into no History. Every other link, the dev
 * client's among them, goes on to Expo Router as it came.
 */
function outsidePath(link: string, route: Route, widgetLinkKey: string | undefined): string | null {
  const path = normalPath(route.path);
  if (collectionLinksPath.test(path)) {
    const id = path.slice('/c/'.length);
    return CollectionLinkIdSchema.safeParse(id).success ? `/c/${id}` : null;
  }
  if (!entryPath.test(path)) return link;
  const params = new URLSearchParams(route.search);
  const fromWidget =
    linkEntryPath.test(path) &&
    params.get('from') === widgetSource &&
    widgetLinkKey !== undefined &&
    params.get('key') === widgetLinkKey;
  return fromWidget ? `${path}${widgetSearch}` : path;
}

/** The App Intent a link's route is, by its path and mark (`APP_INTENT_ROUTES`), or none. */
function appIntentOf(route: Route, linkDomain: string): AppIntent | undefined {
  const path = normalPath(route.path);
  const named = new URLSearchParams(route.search).get(APP_INTENT_PARAM);
  return APP_INTENTS.find(
    (intent) => intent === named && routeOf(APP_INTENT_ROUTES[intent], linkDomain)?.path === path,
  );
}

/** What the outside links read and ask of the app for the App Intents (ADR 0057). */
export interface AppIntentLandings {
  /** Whether the Feature Switch `appIntents` is on in effect. */
  on(): Promise<boolean>;
  /** Asks the Feed to land on today's Word of the Day card. */
  landOnWordOfTheDay(): void;
}

/** What the outside links read and ask of the app for a widget link that opens while it runs. */
export interface WidgetEntries {
  /** Whether the Feature Switch `replaceOpenEntry` is on in effect. */
  replaceOpenEntry(): Promise<boolean>;
  /** Opens the widget's Entry in place of the open Entry (`NotificationTaps`). */
  open: (path: string) => void;
}

/**
 * Expo Router's `redirectSystemPath` (`app/+native-intent.tsx`), which sees
 * every link from outside the app and none from inside it, over the key of
 * the Widget Snapshot the widget reads now, or none without one. The widget's
 * link to an Entry that comes while the app runs, with `replaceOpenEntry` on
 * in effect, goes to `widgetEntries` in place of Expo Router, which would push
 * its Entry over the open one; the link that launches the app opens as it
 * came, over a stack that holds nothing yet. An App
 * Intent's link opens its route without its mark: «Слово дня» the Feed,
 * landing on today's Word of the Day card, and «Відкрити гру» the Game; with
 * `appIntents` off in effect, or unknown, both open the app's start, the Feed
 * as it was (ADR 0057). A link of a native surface that names another
 * Edition than the active one (`edition=<id>`, ADR 0065), left from before a
 * switch, opens the app's start, the active Edition's Feed.
 */
export function createOutsideLinks({
  linkDomain,
  editionId,
  widgetLinkKey,
  appIntents,
  widgetEntries,
}: {
  /** The Edition's link domain, the one host whose web addresses the app opens. */
  linkDomain: string;
  /** The active Edition's id. */
  editionId: string;
  widgetLinkKey: () => Promise<string | undefined>;
  appIntents: AppIntentLandings;
  widgetEntries: WidgetEntries;
}): (link: { path: string; initial: boolean }) => Promise<string | null> {
  return async ({ path, initial }) => {
    const route = routeOf(path, linkDomain);
    if (route === undefined) return null;
    const named = new URLSearchParams(route.search).get(EDITION_PARAM);
    if (named !== null && named !== editionId) return '/';
    const intent = appIntentOf(route, linkDomain);
    if (intent === undefined) {
      const opened = outsidePath(path, route, await widgetLinkKey());
      const fromWidget = opened === `${normalPath(route.path)}${widgetSearch}`;
      if (initial || !fromWidget) return opened;
      if (!(await widgetEntries.replaceOpenEntry().catch(() => false))) return opened;
      widgetEntries.open(opened);
      return null;
    }
    if (!(await appIntents.on().catch(() => false))) return '/';
    if (intent === 'wordOfTheDay') appIntents.landOnWordOfTheDay();
    return routeOf(APP_INTENT_ROUTES[intent], linkDomain)?.path ?? '/';
  };
}
