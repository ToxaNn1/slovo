/**
 * The ports of the server Core: what its modules need from the world, which
 * the backend's adapters give. Modules take them in an object of dependencies,
 * so a test gives its own.
 */
import type { PublishedPack } from '@slovo/contracts';

/** The current time, injected so the rules that read it stay testable. */
export interface Clock {
  now(): Date;
}

export const systemClock: Clock = { now: () => new Date() };

/** The published Language Packs of every Edition, kept by the backend. */
export interface ContentPackStore {
  /** The newest published pack of the Edition in the pack format, if any. */
  latest(editionId: string, packFormat: number): Promise<PublishedPack | undefined>;
}
