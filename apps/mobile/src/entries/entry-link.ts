import { CollectionLinkIdSchema } from '@slovo/contracts';

import { isFromNotification } from '../notifications/notification-scheduler';
import { APP_INTENT_PARAM, APP_INTENT_ROUTES, APP_INTENTS, type AppIntent } from './app-intents';

/** Where outside the app an Entry link opened from: a notification or the home-screen widget. */
export type OpenedFrom = 'notification' | 'widget';

/** The value of the search param `from` that marks an Entry link as the widget's. */
const widgetSource = 'widget';

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

/** The origin of a web address, which Expo Router leaves out of the path it opens. */
const webOrigin = /^https?:\/\/[^/?#]*/i;

/**
 * The path and search of the route a link opens, as Expo Router reads it:
 * after the scheme or the origin of a web address, or, for the dev client's
 * link (`<scheme>://expo-development-client/?url=<link>`), that of the link in
 * its `url`.
 */
function routeOf(link: string): { path: string; search: string } {
  const [location = '', search = ''] = link.replace(webOrigin, '').replace(/#.*$/, '').split('?');
  const rest = location.replace(schemePrefix, '');
  if (schemePrefix.test(location) && /^expo-development-client\/?$/.test(rest)) {
    const inner = new URLSearchParams(search).get('url') ?? '';
    return routeOf(inner);
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
 * address iOS hands the app) or the scheme + `c/<id>`, opens `/c/<id>` with
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
function outsidePath(link: string, widgetLinkKey: string | undefined): string | null {
  const route = routeOf(link);
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
  return fromWidget ? `${path}?from=${widgetSource}` : path;
}

/** The App Intent a link is, by its route and mark (`APP_INTENT_ROUTES`), or none. */
function appIntentOf(link: string): AppIntent | undefined {
  const route = routeOf(link);
  const path = normalPath(route.path);
  const named = new URLSearchParams(route.search).get(APP_INTENT_PARAM);
  return APP_INTENTS.find(
    (intent) => intent === named && routeOf(APP_INTENT_ROUTES[intent]).path === path,
  );
}

/** What the outside links read and ask of the app for the App Intents (ADR 0057). */
export interface AppIntentLandings {
  /** Whether the Feature Switch `appIntents` is on in effect. */
  on(): Promise<boolean>;
  /** Asks the Feed to land on today's Word of the Day card. */
  landOnWordOfTheDay(): void;
}

/**
 * Expo Router's `redirectSystemPath` (`app/+native-intent.tsx`), which sees
 * every link from outside the app and none from inside it, over the key of
 * the Widget Snapshot the widget reads now, or none without one. An App
 * Intent's link opens its route without its mark: «Слово дня» the Feed,
 * landing on today's Word of the Day card, and «Відкрити гру» the Game; with
 * `appIntents` off in effect, or unknown, both open the app's start, the Feed
 * as it was (ADR 0057).
 */
export function createOutsideLinks({
  widgetLinkKey,
  appIntents,
}: {
  widgetLinkKey: () => Promise<string | undefined>;
  appIntents: AppIntentLandings;
}): (link: { path: string }) => Promise<string | null> {
  return async ({ path }) => {
    const intent = appIntentOf(path);
    if (intent === undefined) return outsidePath(path, await widgetLinkKey());
    if (!(await appIntents.on().catch(() => false))) return '/';
    if (intent === 'wordOfTheDay') appIntents.landOnWordOfTheDay();
    return routeOf(APP_INTENT_ROUTES[intent]).path;
  };
}
