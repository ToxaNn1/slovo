import { Stack } from 'expo-router';

/**
 * The Saved tab's own stack: the overview, and in 0.3 Favorites, Collections,
 * a Collection, History and the Entry screen on top of it.
 */
export default function SavedLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
