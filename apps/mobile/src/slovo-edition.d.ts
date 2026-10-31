/**
 * The Edition selected by SLOVO_EDITION. Metro resolves these modules into
 * that Edition's folder (see metro.config.cjs); the app validates what it reads.
 */
declare module 'slovo-edition/config' {
  const config: unknown;
  export default config;
}

declare module 'slovo-edition/strings' {
  const strings: unknown;
  export default strings;
}

/** The Edition's design tokens; empty when it supplies none. */
declare module 'slovo-edition/tokens' {
  const tokens: unknown;
  export default tokens;
}

/** The Edition's Decor; empty when it supplies none. */
declare module 'slovo-edition/decor' {
  const decor: unknown;
  export default decor;
}

/** The AppConfig of the one app (ADR 0065), from `app/app.json`. */
declare module 'slovo-app/config' {
  const config: unknown;
  export default config;
}

/** The native splash the AppConfig names (Decor slot 7). */
declare module 'slovo-app/splash' {
  const splash: unknown;
  export default splash;
}

/** The asset ids of the Illustrations the Edition brings, by file name. */
declare module 'slovo-edition/illustrations' {
  const illustrations: Readonly<Record<string, number>>;
  export default illustrations;
}

declare module 'slovo-edition/language-pack' {
  /** The asset id of the compiled Language Pack. */
  const assetId: number;
  export default assetId;
}

/** The plural rules of the Edition's language, which it adds to the `Intl.PluralRules` polyfill. */
declare module 'slovo-edition/plural-rules';
