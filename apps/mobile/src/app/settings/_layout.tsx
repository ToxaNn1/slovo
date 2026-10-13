import { Stack } from 'expo-router';

/** Settings' own stack: the list, and the screens its rows open. Screens draw their own header. */
export default function SettingsLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
