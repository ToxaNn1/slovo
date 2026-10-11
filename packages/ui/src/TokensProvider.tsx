import type { ColorTokens } from '@slovo/contracts';
import { createContext, useContext, useMemo, type ReactNode } from 'react';

import { coreTokens, type ColorScheme, type DesignTokens } from './tokens';

/** The design tokens in effect for the colour scheme the app is drawn in. */
export interface Tokens {
  readonly colorScheme: ColorScheme;
  readonly colors: ColorTokens;
  readonly fontFamilies: DesignTokens['fontFamilies'];
  readonly radii: DesignTokens['radii'];
}

function tokensFor(tokens: DesignTokens, colorScheme: ColorScheme): Tokens {
  return {
    colorScheme,
    colors: tokens.colors[colorScheme],
    fontFamilies: tokens.fontFamilies,
    radii: tokens.radii,
  };
}

const TokensContext = createContext<Tokens>(tokensFor(coreTokens, 'light'));

/** Gives every component below the tokens for the colour scheme in effect. */
export function TokensProvider({
  tokens,
  colorScheme,
  children,
}: {
  tokens: DesignTokens;
  colorScheme: ColorScheme;
  children: ReactNode;
}) {
  const value = useMemo(() => tokensFor(tokens, colorScheme), [tokens, colorScheme]);
  return <TokensContext value={value}>{children}</TokensContext>;
}

/** The design tokens in effect; the Core's light tokens outside a provider. */
export function useTokens(): Tokens {
  return useContext(TokensContext);
}
