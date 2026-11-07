import { openHiddenEntries, type HiddenEntries } from './hidden-entries';
import type { Clock, ContentReadPort } from '../ports';
import type { Subject } from '../subject';
import type { UserState } from '../user-state/user-state';
import { createEntries, type Entries } from '../entries/entries';
import { createEntryRows, type EntryRows } from '../entries/entry-row';
import { openMix, type Mix, type MixEdition } from '../entries/mix';
import {
  openRarityCeiling,
  type RarityCeiling,
  type RarityCeilingEdition,
} from '../entries/rarity-ceiling';

/** What decides which Entries are eligible: the Entries and the reader's choices they read. */
export interface Eligibility {
  readonly entries: Entries;
  readonly rows: EntryRows;
  readonly mix: Mix;
  readonly rarityCeiling: RarityCeiling;
  readonly hiddenEntries: HiddenEntries;
}

/**
 * Opens the Entries over the reader's choices, read live: the Mix, then the
 * Rarity Ceiling, then the Hidden Entries, each over the user state and
 * telling `eligibility` after each change. The Entries are made first, as
 * the Mix opens over their Categories; nothing reads an eligible Entry until
 * all three are open. The one wiring the Core composition and its tests share.
 */
export async function openEligibility({
  content,
  edition,
  userState,
  clock,
  eligibility,
}: {
  content: ContentReadPort;
  edition: Parameters<typeof createEntries>[0]['edition'] & MixEdition & RarityCeilingEdition;
  userState: UserState;
  clock: Clock;
  eligibility: Subject<void>;
}): Promise<Eligibility> {
  const entries = createEntries({
    content,
    edition,
    choices: {
      mix: () => mix.state,
      rarityCeiling: () => rarityCeiling.state,
      isHidden: (entryId) => hiddenEntries.has(entryId),
    },
  });
  const rows = createEntryRows(entries);
  const [word, correction] = await Promise.all([
    entries.categories(),
    entries.correctionCategories(),
  ]);
  const mix = await openMix({ edition, categories: { word, correction }, userState, eligibility });
  const rarityCeiling = await openRarityCeiling({ edition, userState, eligibility });
  const hiddenEntries = await openHiddenEntries({ rows, userState, clock, eligibility });
  return { entries, rows, mix, rarityCeiling, hiddenEntries };
}
