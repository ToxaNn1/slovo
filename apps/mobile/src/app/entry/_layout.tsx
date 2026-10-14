import { Stack } from 'expo-router';

/**
 * The stack of an Entry opened from a link, such as a notification's: its
 * Entry screen, and the Correction screens a Word card links open over it.
 */
export default function EntryLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
