/**
 * The Editions the app bundles (ADR 0065). Metro writes this module from the
 * Edition folders (see metro.config.cjs); the app's Edition registry
 * validates what it reads.
 */
declare module 'slovo-editions' {
  /** The files of one bundled Edition, as Metro bundles them. */
  export interface BundledEditionFiles {
    readonly config: unknown;
    readonly strings: unknown;
    /** Undefined when the Edition supplies none: the Core's neutral tokens. */
    readonly tokens: unknown;
    /** Undefined when the Edition supplies none: the Core's neutral Decor. */
    readonly decor: unknown;
    /** The asset ids of the Illustrations the Edition brings, by file name. */
    readonly illustrations: Readonly<Record<string, number>>;
    /** The asset id of the compiled Language Pack. */
    readonly languagePack: number;
  }
  const bundled: {
    /** The Edition the build bundles as its default. */
    readonly defaultId: string;
    /** Every bundled Edition by its id. */
    readonly editions: Readonly<Record<string, BundledEditionFiles>>;
  };
  export default bundled;
}

/** The plural rules of every bundled Edition's language, added to the `Intl.PluralRules` polyfill. */
declare module 'slovo-editions/plural-rules';

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
