/**
 * The global setup of the backend's tests, which Vitest runs once before every
 * test file: it writes the UA Edition from the seed snapshot and records it, and
 * hands its folder to the test files (`inject('ukrainianSeed')`), which copy its content.
 * Recording appends the crossword days the snapshot lacks to keep 400 days ahead,
 * which takes seconds; done once here, recording a copy finds them there.
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { recordContent } from '@slovo/language-pack';
import { ukrainianSeedFolder } from '@slovo/language-pack/test-support';
import type { TestProject } from 'vitest/node';

declare module 'vitest' {
  export interface ProvidedContext {
    /** The folder of the UA Edition written from the seed snapshot and recorded. */
    ukrainianSeed: string;
  }
}

export default function setup(project: TestProject): () => void {
  const dir = mkdtempSync(join(tmpdir(), 'slovo-seed-'));
  const editionDir = ukrainianSeedFolder(dir);
  if (!recordContent({ editionDir }).ok) throw new Error('The seed content was not recorded');
  project.provide('ukrainianSeed', editionDir);
  return () => {
    rmSync(dir, { recursive: true, force: true });
  };
}
