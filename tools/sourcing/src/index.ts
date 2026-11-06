/**
 * The content sourcing tool: dev-only, never shipped. It drafts Entries from
 * dictionary sources for a human to review before they enter an Edition.
 */
export {
  fetchGoroh,
  gorohUrl,
  readArticleBlocks,
  type ArticleBlock,
  type GorohSection,
} from './goroh';
export {
  REPORT_FILE,
  runSourcing,
  type DraftContext,
  type KindDraft,
  type KindOutcome,
  type ParsedLine,
  type PipelineOptions,
  type SourcingKind,
  type SourcingResult,
} from './pipeline';
export {
  PoliteClient,
  type Clock,
  type Fetch,
  type FetchResponse,
  type RequestStats,
} from './polite-client';
export { formatReviewReport } from './report';
export type {
  DraftOutcome,
  DraftSummary,
  Flag,
  FlagKind,
  LemmaOutcome,
  ReviewReport,
} from './review-report';
export { sourceIdioms, type IdiomSourcingOptions } from './idioms';
export { sourceWords, type SourcingOptions } from './source-words';
export type { SumAccess } from './sum';
