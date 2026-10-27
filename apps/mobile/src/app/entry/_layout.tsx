import { ScreenStack } from '@/entries/screen-stack';

/**
 * The stack of an Entry opened from a link, such as a notification's: its
 * Entry screen, and the Correction screens a Word card links open over it.
 * A notification tapped while an Entry a link opened (a notification's or the
 * widget's) is on top replaces that Entry, so «Назад» returns to where the
 * reader was before it; over any other screen it opens on top
 * (`NotificationTaps`).
 */
export default function EntryLayout() {
  return <ScreenStack />;
}
