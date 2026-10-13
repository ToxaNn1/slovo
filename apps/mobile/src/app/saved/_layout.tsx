import { Stack } from 'expo-router';

/**
 * The Saved tab's own stack: the overview, and Favorites (later Collections,
 * a Collection and History), each with the Entry screen its rows open.
 */
export default function SavedLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
