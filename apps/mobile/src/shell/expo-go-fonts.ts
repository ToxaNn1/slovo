import { isRunningInExpoGo } from 'expo';
import { useFonts } from 'expo-font';
import editionFonts from 'slovo-editions/fonts';

/**
 * Whether the Edition's fonts are ready to draw. A build embeds them with the
 * `expo-font` plugin; Expo Go lacks them, so there they load at runtime and
 * the app waits for them, to look as the build does.
 */
export function useEditionFontsReady(): boolean {
  const [loaded, error] = useFonts(isRunningInExpoGo() ? editionFonts : {});
  return loaded || error !== null;
}
