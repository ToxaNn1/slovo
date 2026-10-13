import { Stack } from 'expo-router';

/**
 * The Saved tab's own stack: the overview, Favorites, Collections (later a
 * Collection) and History, each list with the Entry screen its rows open.
 */
export default function SavedLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
