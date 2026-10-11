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

declare module 'slovo-edition/language-pack' {
  /** The asset id of the compiled Language Pack. */
  const assetId: number;
  export default assetId;
}
