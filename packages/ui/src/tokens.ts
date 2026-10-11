/**
 * Placeholder design tokens, just enough for the Word card. The real tokens
 * come from the design for 0.2 and from each Edition.
 */
export const space = { s: 8, m: 16, l: 24, xl: 40 } as const;

export const fontSize = { body: 17, caption: 15, lemma: 44 } as const;

export const colors = {
  light: { background: '#FAF7F0', text: '#1C1B19', muted: '#6B675F' },
  dark: { background: '#161513', text: '#F2EEE6', muted: '#A39E94' },
} as const;

export type ColorScheme = keyof typeof colors;
