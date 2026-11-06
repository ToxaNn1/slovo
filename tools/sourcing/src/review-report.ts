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
  /** The draft file, relative to the kind's folder in the review folder. */
  readonly file: string;
  /** Whether the draft passes the Word schema and the Edition's checks. */
  readonly ready: boolean;
  /** The dictionary headword it was drafted from, e.g. `КОСА́ 2`. */
  readonly headword: string;
  /** What stops the draft from being ready, as `field: message`. */
  readonly issues: readonly string[];
  readonly flags: readonly Flag[];
  readonly summary: DraftSummary;
}

/** What the «Ready drafts» list shows of a draft. */
export interface DraftSummary {
  /** The text the Entry is known by: a Word's Lemma. */
  readonly text: string;
  /** The Category, or the type of a kind that has one instead. */
  readonly group: string;
  readonly examples: number;
  /** The primary Definition; empty when the sources gave none. */
  readonly definition: string;
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
  | 'existing-entry'
  | 'cross-reference'
  | 'region-missing'
  | 'check';

export interface Flag {
  readonly kind: FlagKind;
  readonly message: string;
}
