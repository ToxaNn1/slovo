import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Where the Core keeps the font files of the word and UI families its tokens
 * name (ADR 0006). Build tooling reads it; the app never imports this module.
 */
export const CORE_FONTS_DIR = fileURLToPath(new URL('../assets/fonts', import.meta.url));

/** Every font file the Core brings, in code-unit order. */
export function coreFonts(): string[] {
  return readdirSync(CORE_FONTS_DIR)
    .filter((file) => /\.(otf|ttf)$/.test(file))
    .toSorted()
    .map((file) => join(CORE_FONTS_DIR, file));
}
