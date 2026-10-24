import { isFromNotification } from '../notifications/notification-scheduler';

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

/** A link's scheme, such as `slovo-uk://`, after which its host is the first part of the path. */
const schemePrefix = /^[a-z][a-z0-9+.-]*:\/\//i;

/**
 * The path and search of the route a link opens, as Expo Router reads it:
 * after the scheme, or, for the dev client's link
 * (`<scheme>://expo-development-client/?url=<link>`), that of the link in its
 * `url`, with the origin of a web address taken away.
 */
function routeOf(link: string): { path: string; search: string } {
  const [location = '', search = ''] = link.replace(/#.*$/, '').split('?');
  const rest = location.replace(schemePrefix, '');
  if (schemePrefix.test(location) && /^expo-development-client\/?$/.test(rest)) {
    const inner = new URLSearchParams(search).get('url') ?? '';
    return routeOf(inner.replace(/^https?:\/\/[^/?#]*/i, ''));
  }
  return { path: `/${rest.replace(/^\/+/, '')}`, search };
}

/** A path with each run of `/` made one and no `/` at its end, as Expo Router matches it. */
function normalPath(path: string): string {
  return path.replace(/\/{2,}/g, '/').replace(/(.)\/$/, '$1');
}

/**
 * The path a link from outside the app opens, such as a link another app or
 * a web page opens with the Edition's scheme. A link to an Entry, on any of
 * its routes and whatever its slashes, opens with its path and none of its
 * search params, so it can't name the label of «Назад» or pass for a
 * notification's link, which never comes from outside (`NotificationTaps`
 * opens it inside the app). Only the widget's link keeps its mark, only to
 * `/entry/<id>` and only with the key of the Widget Snapshot the widget reads
 * now, which an app or a web page can't read; any other is a plain link, so
 * its Entry is not Seen and goes into no History. Every other link, the dev
 * client's among them, goes on to Expo Router as it came.
 */
function outsidePath(link: string, widgetLinkKey: string | undefined): string {
  const route = routeOf(link);
  const path = normalPath(route.path);
  if (!entryPath.test(path)) return link;
  const params = new URLSearchParams(route.search);
  const fromWidget =
    linkEntryPath.test(path) &&
    params.get('from') === widgetSource &&
    widgetLinkKey !== undefined &&
    params.get('key') === widgetLinkKey;
  return fromWidget ? `${path}?from=${widgetSource}` : path;
}

/**
 * Expo Router's `redirectSystemPath` (`app/+native-intent.tsx`), which sees
 * every link from outside the app and none from inside it, over the key of
 * the Widget Snapshot the widget reads now, or none without one.
 */
export function createOutsideLinks(
  widgetLinkKey: () => Promise<string | undefined>,
): (link: { path: string }) => Promise<string> {
  return async ({ path }) => outsidePath(path, await widgetLinkKey());
}
