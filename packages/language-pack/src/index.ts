/**
 * The Language Pack: compiles an Edition's content into a read-only SQLite
 * file, and opens such files in Node for tests and tooling. The mobile shell
 * reads packs through `@slovo/language-pack/reader`, which needs no Node APIs.
 * Each build checks the content against the targets the Edition declares.
 * Edition folders are read through `@slovo/language-pack/edition`, which loads
 * no SQLite, so the app config and Metro use it too (ADR 0035).
 */
export {
  buildFromBackend,
  buildFromSnapshot,
  buildLanguagePack,
  checkLanguagePack,
  type BuildResult,
  type CheckResult,
} from './build';
export { formatBuildError, type BuildError } from './build-error';
export { generateDailyCrossword, type CrosswordResult } from './crossword';
export { missedTargets, wordsPerRarityFloor, wordFloor } from './content-targets';
export type { ContentTarget, ContentTargets, MissedTarget } from './content-targets';
export { PACK_FORMAT } from './pack-layout';
export { applyPatch, patchStateOf, type PackWriteDatabase } from './apply-patch';
export { openLanguagePack, type NodeLanguagePack } from './read-pack';
export { readEdition, type EditionSource } from './read-edition';
export { recordContent, type RecordResult } from './record';
export { contentReport, formatContentReport, type ContentReport } from './report';
export { fetchSnapshot, readSnapshotFile, SnapshotUnreachableError } from './snapshot-source';
