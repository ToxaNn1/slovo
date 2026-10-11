/**
 * The content sourcing tool: dev-only, never shipped. It drafts Words from
 * dictionary sources for a human to review before they enter an Edition.
 */
export type { Clock, Fetch, FetchResponse, RequestStats } from './polite-client';
export { formatReviewReport } from './report';
export {
  REPORT_FILE,
  sourceWords,
  type DraftOutcome,
  type Flag,
  type FlagKind,
  type LemmaOutcome,
  type ReviewReport,
  type SourcingOptions,
  type SourcingResult,
} from './source-words';
export type { SumAccess } from './sum';
