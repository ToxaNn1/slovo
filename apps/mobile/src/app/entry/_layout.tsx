import { ScreenStack } from '@/entries/screen-stack';

/**
 * The stack of an Entry opened from a link, such as a notification's, or from
 * the Feed: its Entry screen, and the Correction screens a Word card links
 * open over it. A notification tapped or a widget link opened replaces
 * whatever is on it, the Entry the reader left with «Назад» too, with its
 * Entry alone, so one «Назад» returns to where the reader was before it, the
 * Feed (`NotificationTaps`).
 */
export default function EntryLayout() {
  return <ScreenStack />;
}
