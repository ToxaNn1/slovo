import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { ExpoConfig } from 'expo/config';
import { withFinalizedMod } from 'expo/config-plugins';

/** The colour set `expo-splash-screen` writes into the asset catalog, in each Theme. */
const SPLASH_COLOUR = '<color key="backgroundColor" name="SplashScreenBackground"/>';
/** The launch screen's container view, from its opening tag to its own background colour. */
const CONTAINER_BACKGROUND =
  /(<view key="view"[^>]*id="EXPO-ContainerView"[^>]*>(?:(?!<\/?view[\s>])[\s\S])*?)<color key="backgroundColor"[^>]*\/>/;

/**
 * Draws the native launch screen in the splash colour of the asset catalog.
 * `expo-splash-screen` paints the storyboard's container view only when the
 * splash has an image; with a colour alone the view keeps the template's
 * system background, white in the light Theme. This runs as the finalized
 * mod, after `expo-splash-screen` has written the storyboard.
 */
export function withSplashBackground(config: ExpoConfig): ExpoConfig {
  return withFinalizedMod(config, [
    'ios',
    async (modConfig) => {
      const { platformProjectRoot, projectName = '' } = modConfig.modRequest;
      const file = join(platformProjectRoot, projectName, 'SplashScreen.storyboard');
      const storyboard = await readFile(file, 'utf8');
      if (!CONTAINER_BACKGROUND.test(storyboard)) {
        throw new Error(`${file} has no container view with a background colour to paint`);
      }
      await writeFile(file, storyboard.replace(CONTAINER_BACKGROUND, `$1${SPLASH_COLOUR}`));
      return modConfig;
    },
  ]);
}
