import type { ColorTokens } from '@slovo/contracts';

/**
 * The page's colour variables for one Theme, from the Edition's colour tokens
 * (ADR 0070). Tailwind's theme (styles/global.css) names them.
 */
export function themeVariables(colors: ColorTokens): string {
  const vars: Record<string, string> = {
    bg: colors.background,
    ink: colors.ink,
    sf: colors.surface,
    sf2: colors.surfaceSunken,
    line: colors.line,
    mute: colors.muted,
    tile: colors.tile,
    edge: colors.tileEdge,
  };
  return Object.entries(vars)
    .map(([name, value]) => `--${name}:${value};`)
    .join('');
}
