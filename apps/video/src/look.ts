import { loadFont } from '@remotion/fonts';
import { staticFile, useVideoConfig } from 'remotion';

import tokens from '../../../editions/uk/tokens.json';

/** The UA Edition's Рупор palette, the light Theme on cream, the dark one on black. */
export const light = tokens.colors.light;
export const dark = tokens.colors.dark;

export const wordFont = tokens.fontFamilies.word;
export const uiFont = tokens.fontFamilies.ui;

// The fonts the app ships, read from the Edition's assets (remotion.config.ts).
void Promise.all([
  loadFont({ family: wordFont, url: staticFile('fonts/Unbounded-Black.ttf'), weight: '900' }),
  loadFont({ family: wordFont, url: staticFile('fonts/Unbounded-ExtraBold.ttf'), weight: '800' }),
  loadFont({ family: uiFont, url: staticFile('fonts/Onest-Medium.ttf'), weight: '500' }),
  loadFont({ family: uiFont, url: staticFile('fonts/Onest-SemiBold.ttf'), weight: '600' }),
]);

/**
 * The frame's shape and its unit: one unit is one pixel of a 1920×1080
 * landscape frame or of a 1080×1920 portrait one, so sizes read the same.
 */
export function useLayout() {
  const { width, height } = useVideoConfig();
  const portrait = height > width;
  return { width, height, portrait, s: portrait ? width / 1080 : width / 1920 };
}
