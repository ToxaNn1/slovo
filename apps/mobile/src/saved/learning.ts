import type { LearningEntry } from '@slovo/core';

import { useComposition } from '../composition';
import { useSubscribed } from '../opening';

/**
 * The Entries the reader is learning, the next Review first, each with how
 * many local days until it (ADR 0043), kept up to date with every Knowledge
 * Mark and every new local day. None with the knowledge Feature Switch off.
 */
export function useLearningList(): readonly LearningEntry[] {
  return useSubscribed(useComposition().knowledge, ({ state }) => state.learning);
}
