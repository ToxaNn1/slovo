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

/** Both colour schemes, so a part of the screen can be drawn in the other one. */
const DesignTokensContext = createContext<DesignTokens>(coreTokens);

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
  return (
    <DesignTokensContext value={tokens}>
      <TokensContext value={value}>{children}</TokensContext>
    </DesignTokensContext>
  );
}

/**
 * Draws everything below in the other colour scheme's tokens, Decor included,
 * as the design's inverted surfaces have it: a card on the ink fill, a toast.
 */
export function InvertedTokens({ children }: { children: ReactNode }) {
  const tokens = useContext(DesignTokensContext);
  const { colorScheme } = useTokens();
  return (
    <TokensProvider tokens={tokens} colorScheme={colorScheme === 'light' ? 'dark' : 'light'}>
      {children}
    </TokensProvider>
  );
}

/**
 * The colours of one colour scheme, whichever is in effect, for what the
 * design draws alike in both Themes, such as the Game's answer fills.
 */
export function useSchemeColors(colorScheme: ColorScheme): ColorTokens {
  return useContext(DesignTokensContext).colors[colorScheme];
}

/** The design tokens in effect; the Core's light tokens outside a provider. */
export function useTokens(): Tokens {
  return useContext(TokensContext);
}
