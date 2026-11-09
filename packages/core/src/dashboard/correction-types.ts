import {
  CorrectionIdSchema,
  CorrectionTypeSchema,
  type Correction,
  type CorrectionType,
} from '@slovo/contracts';

import type { Edition } from '../edition/edition';
import type { Entries } from '../entries/entries';
import { createSubscribers } from '../in-turn';
import type { UserState } from '../user-state/user-state';
import { dashboardRecords } from './records';

/**
 * One tile of the Correction Types rail (ADR 0076): a Correction Type with
 * live Corrections, how many there are and how many are «розібрано».
 */
export interface CorrectionTypeTile {
  readonly type: CorrectionType;
  /** N: the live Corrections of the type. */
  readonly total: number;
  /** X: those of them worked through, on the Feed or through «Як правильно?». */
  readonly workedThrough: number;
}

/** A Correction on its type's screen: revealed when worked through, else behind «Як правильно?». */
export interface CorrectionTypeRow {
  readonly correction: Correction;
  readonly workedThrough: boolean;
}

/**
 * The Correction Types (ADR 0076): the rail's tiles and each type's
 * Corrections. A Correction is «розібрано» once its standard form was shown:
 * Seen on the Feed, or revealed with «Як правильно?» on the type's screen.
 * With `correctionTypes` off there are no tiles and no Corrections.
 */
export interface CorrectionTypes {
  /** The tiles in the contract's order of types, the types without live Corrections left out. */
  readonly tiles: readonly CorrectionTypeTile[];
  /** Calls `listener` after each change of the tiles. Returns the call that stops it. */
  subscribe(listener: () => void): () => void;
  /** The live Corrections of `type` in the Language Pack's order, each with whether it is worked through. */
  corrections(type: CorrectionType): Promise<readonly CorrectionTypeRow[]>;
  /** «Як правильно?»: marks the Correction worked through, once; the tiles follow. */
  reveal(correctionId: string): Promise<void>;
}

export async function openCorrectionTypes({
  edition,
  entries,
  userState,
  seen,
}: {
  edition: Pick<Edition, 'isFeatureEnabled'>;
  entries: Pick<Entries, 'liveCorrections'>;
  userState: Pick<UserState, 'list' | 'write'>;
  seen: { subscribe(listener: (entryId: string) => unknown): unknown };
}): Promise<CorrectionTypes> {
  const subscribers = createSubscribers();
  const on = edition.isFeatureEnabled('correctionTypes');
  const records = dashboardRecords.correctionsWorkedThrough;

  async function live(): Promise<readonly Correction[]> {
    return on ? entries.liveCorrections() : [];
  }

  async function workedThroughIds(): Promise<ReadonlySet<string>> {
    return new Set((await userState.list(records)).keys());
  }

  async function tilesOf(): Promise<readonly CorrectionTypeTile[]> {
    const [corrections, done] = await Promise.all([live(), workedThroughIds()]);
    return CorrectionTypeSchema.options.flatMap((type) => {
      const ofType = corrections.filter((correction) => correction.correctionType === type);
      if (ofType.length === 0) return [];
      const workedThrough = ofType.filter(({ id }) => done.has(id)).length;
      return [{ type, total: ofType.length, workedThrough }];
    });
  }

  let tiles = await tilesOf();

  /** Marks a live Correction worked through, once; a Word or an unknown id changes nothing. */
  async function markWorkedThrough(correctionId: string): Promise<void> {
    const [corrections, done] = await Promise.all([live(), workedThroughIds()]);
    if (done.has(correctionId) || !corrections.some(({ id }) => id === correctionId)) return;
    await userState.write(records.record(correctionId).change(true));
    tiles = await tilesOf();
    subscribers.tell();
  }

  // A Seen Word reads nothing; a read that fails here leaves the Correction to its next Seen.
  if (on)
    seen.subscribe(async (entryId) => {
      if (!CorrectionIdSchema.safeParse(entryId).success) return;
      await markWorkedThrough(entryId).catch(() => undefined);
    });

  return {
    get tiles() {
      return tiles;
    },
    subscribe: subscribers.subscribe,
    async corrections(type) {
      const [corrections, done] = await Promise.all([live(), workedThroughIds()]);
      return corrections
        .filter((correction) => correction.correctionType === type)
        .map((correction) => ({ correction, workedThrough: done.has(correction.id) }));
    },
    reveal: markWorkedThrough,
  };
}
