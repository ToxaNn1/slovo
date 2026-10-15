import type { RequestStats } from './polite-client';

export interface ReviewReport {
  readonly lemmas: readonly LemmaOutcome[];
  readonly requests: RequestStats;
}

export interface LemmaOutcome {
  readonly lemma: string;
  /** The line of the Lemma list. */
  readonly line: number;
  readonly drafts: readonly DraftOutcome[];
  /** What a human must look at for the Lemma as a whole. */
  readonly flags: readonly Flag[];
}

export interface DraftOutcome {
  readonly id: string;
  /** The draft file, relative to the review folder. */
  readonly file: string;
  /** Whether the draft passes the Word schema and the Edition's checks. */
  readonly ready: boolean;
  /** The dictionary headword it was drafted from, e.g. `КОСА́ 2`. */
  readonly headword: string;
  /** What stops the draft from being ready, as `field: message`. */
  readonly issues: readonly string[];
  readonly flags: readonly Flag[];
}

export type FlagKind =
  | 'no-entry'
  | 'fetch-failed'
  | 'homonym'
  | 'several-stresses'
  | 'stress-unresolved'
  | 'plural-only'
  | 'sources-disagree'
  | 'missing-data'
  | 'needs-assignment'
  | 'unmarked-examples'
  | 'other-labels'
  | 'spelling-differs'
  | 'check';

export interface Flag {
  readonly kind: FlagKind;
  readonly message: string;
}
