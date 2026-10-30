import { ScreenStack } from '@/entries/screen-stack';

/**
 * The stack of an Entry opened from a link, such as a notification's, or from
 * the Feed: its Entry screen, and the Correction screens a Word card links
 * open over it. A notification tapped while this stack is on top, whatever is
 * on it, replaces the whole stack with its Entry, so one «Назад» returns to
 * where the reader was before it, the Feed; over any other screen it opens on
 * top (`NotificationTaps`).
 */
export default function EntryLayout() {
  return <ScreenStack />;
}
