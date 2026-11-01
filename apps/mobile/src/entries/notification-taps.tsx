import type { NotificationKind } from '@slovo/core';
import { useEffect, useEffectEvent } from 'react';

import { onDeviceNotificationTap } from '../notifications/device-notifications';
import { useReplaceOpenEntry } from './replace-open-entry';
import { widgetEntryLinks } from './widget-entry-links';

/**
 * Opens the Word of each notification the reader taps, and of each widget
 * link the outside links hand over while the app runs, on the Entry stack of
 * links (`/entry`). Whatever that stack holds (the Entry of a notification,
 * the widget or the Feed, a Correction opened over one, or the Entry the
 * reader left with «Назад»), the new Entry takes the place of the whole
 * stack, so one «Назад» returns to where the reader was before it, the Feed
 * (`useReplaceOpenEntry`). Hands the kind of each tapped notification to
 * `onOpened`, for Analytics. Draws nothing.
 */
export function NotificationTaps({
  onTap = onDeviceNotificationTap,
  onWidgetLink = widgetEntryLinks.listen,
  onOpened = () => undefined,
}: {
  /**
   * Calls `open` with the link of each tapped notification of a Word and
   * `opened` with the kind of each tapped one; returns the call that stops it.
   */
  onTap?: (open: (link: string) => void, opened: (kind: NotificationKind) => void) => () => void;
  /** Calls `open` with each widget link handed over; returns the call that stops it. */
  onWidgetLink?: (open: (link: string) => void) => () => void;
  /** Takes the kind of each tapped notification. */
  onOpened?: ((kind: NotificationKind) => void) | undefined;
}) {
  const replaceOpenEntry = useReplaceOpenEntry();
  const open = useEffectEvent((link: string) => {
    replaceOpenEntry(link);
  });
  const opened = useEffectEvent((kind: NotificationKind) => {
    onOpened(kind);
  });
  useEffect(() => onTap(open, opened), [onTap]);
  useEffect(() => onWidgetLink(open), [onWidgetLink]);
  return null;
}
