import { isFromNotification } from '../notifications/notification-scheduler';

/** Where outside the app an Entry link opened from: a notification or the home-screen widget. */
export type OpenedFrom = 'notification' | 'widget';

/** The value of the search param `from` that marks an Entry link as the widget's. */
const widgetSource = 'widget';

/**
 * Where outside the app the search params of an Entry link say it opened
 * from, or nothing for a link from inside the app. The widget's link is the
 * Edition's scheme + `entry/<id>?from=widget`.
 */
export function openedFromOf(params: { readonly from?: string }): OpenedFrom | undefined {
  if (isFromNotification(params)) return 'notification';
  if (params.from === widgetSource) return 'widget';
  return undefined;
}
