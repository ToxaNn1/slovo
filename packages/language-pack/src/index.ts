/**
 * The Language Pack: compiles an Edition's content into a read-only SQLite
 * file, and opens such files in Node for tests and tooling.
 */
export { buildLanguagePack, formatBuildError, type BuildError, type BuildResult } from './build';
export type { PackMetadata } from './pack-layout';
export { openLanguagePack, type NodeLanguagePack } from './read-pack';
