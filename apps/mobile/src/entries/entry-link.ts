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

/** An Entry's path, `entry/<id>`, after the scheme or a leading slash. */
const entryPath = /^\/entry\/[^/]+$/;

/**
 * The path a link from outside the app opens, such as a link another app or
 * a web page opens with the Edition's scheme: the link's path and none of its
 * search params, so it can't name the label of «Назад» or pass for a
 * notification's link, which never comes from outside (`NotificationTaps`
 * opens it inside the app). Only the widget's link to an Entry keeps its mark,
 * and only with the key of the Widget Snapshot the widget reads now, which an
 * app or a web page can't read; any other is a plain link, so its Entry is
 * not Seen and goes into no History.
 */
function outsidePath(link: string, widgetLinkKey: string | undefined): string {
  const [location = '', search = ''] = link.replace(/#.*$/, '').split('?');
  const path = `/${location.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '').replace(/^\/+/, '')}`;
  const params = new URLSearchParams(search);
  const fromWidget =
    params.get('from') === widgetSource &&
    widgetLinkKey !== undefined &&
    params.get('key') === widgetLinkKey;
  return entryPath.test(path) && fromWidget ? `${path}?from=${widgetSource}` : path;
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
