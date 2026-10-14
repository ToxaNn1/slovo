/**
 * The Language Pack: compiles an Edition's content into a read-only SQLite
 * file, and opens such files in Node for tests and tooling. The mobile shell
 * reads packs through `@slovo/language-pack/reader`, which needs no Node APIs.
 * Each build checks the content against the targets the Edition declares.
 */
export { buildLanguagePack, type BuildResult } from './build';
export { checkNewWords } from './check-new-words';
export { ID_REGISTRY_FILE, IdRegistrySchema } from './id-registry';
export { formatBuildError, type BuildError } from './build-error';
export type { ContentTarget, ContentTargets, MissedTarget } from './content-targets';
export type { PackMetadata } from './pack-layout';
export { openLanguagePack, type NodeLanguagePack } from './read-pack';
export { recordContent, type RecordResult } from './record';
export { formatContentReport, type ContentReport } from './report';
