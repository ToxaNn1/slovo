/**
 * The ports of the server Core: what its modules need from the world, which
 * the backend's adapters give. Modules take them in an object of dependencies,
 * so a test gives its own.
 */
import type { PackMetadata, PublishedPack } from '@slovo/contracts';

/** The current time, injected so the rules that read it stay testable. */
export interface Clock {
  now(): Date;
}

export const systemClock: Clock = { now: () => new Date() };

/** The published Language Packs of every Edition, kept by the backend. */
export interface ContentPackStore {
  /** The newest published pack of the Edition in the pack format, if any. */
  latest(editionId: string, packFormat: number): Promise<PublishedPack | undefined>;
  /**
   * Keeps the pack unless `refuse`, given every content version published
   * for its Edition, names why not, and answers that reason. The check and
   * the insert run in one transaction, and no other publishing of the
   * Edition comes between them. A kept pack is never updated.
   */
  publish<Refusal>(
    pack: ContentPack,
    refuse: (publishedVersions: readonly number[]) => Refusal | undefined,
  ): Promise<Refusal | undefined>;
}

/** A built Language Pack file: the bytes, the metadata recorded in them and their SHA-256. */
export interface PackFile {
  readonly metadata: PackMetadata;
  /** The SHA-256 of the file, as 64 lowercase hex digits; not the content checksum. */
  readonly fileSha256: string;
  readonly bytes: Uint8Array;
}

/** A Language Pack file as it is published. */
export interface ContentPack extends PackFile {
  readonly publishedAt: Date;
}
