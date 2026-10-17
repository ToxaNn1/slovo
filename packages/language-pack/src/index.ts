/**
 * The Language Pack: compiles an Edition's content into a read-only SQLite
 * file, and opens such files in Node for tests and tooling. The mobile shell
 * reads packs through `@slovo/language-pack/reader`, which needs no Node APIs.
 * Each build checks the content against the targets the Edition declares.
 * Edition folders are read through `@slovo/language-pack/edition`, which loads
 * no SQLite, so the app config and Metro use it too (ADR 0035).
 */
export { buildLanguagePack, type BuildResult } from './build';
export { formatBuildError, type BuildError } from './build-error';
export type { ContentTarget, ContentTargets, MissedTarget } from './content-targets';
export { openLanguagePack, type NodeLanguagePack } from './read-pack';
export { recordContent, type RecordResult } from './record';
export { formatContentReport, type ContentReport } from './report';
