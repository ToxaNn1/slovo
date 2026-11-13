import type { CorrectionType } from '@slovo/contracts';
import type { Composition, CorrectionTypeRow } from '@slovo/core';
import { useCallback } from 'react';

import { useComposition, useCompositionRead } from '../composition';
import { keep } from '../keep';
import { editionStrings } from '../edition/edition';

/** What tells of a change to a Correction Type's screen. */
const changes = (open: Composition) => open.correctionTypes;

/** What a Correction Type's screen draws and does. */
export interface CorrectionTypeScreen {
  /** The tile's name, «Суржик». */
  readonly title: string;
  /** The line under the title, «Слова, що прослизають у мову непомітно.». */
  readonly description: string;
  /** The tile's place on the rail, which picks its glyph; 0 once it left the rail. */
  readonly place: number;
  /** The type's live Corrections in the Language Pack's order; nothing until the first read ends. */
  readonly rows: readonly CorrectionTypeRow[] | undefined;
  /** «Відповідь»: marks the Correction worked through, which reveals it in place. */
  readonly reveal: (correctionId: string) => void;
}

/**
 * A Correction Type's screen (ADR 0076): its Corrections, read again each
 * time the tiles change, so a Correction revealed here or Seen on the Feed
 * shows its standard form.
 */
export function useCorrectionTypeScreen(type: CorrectionType): CorrectionTypeScreen {
  const { correctionTypes } = useComposition();
  const read = useCallback((open: Composition) => open.correctionTypes.corrections(type), [type]);
  const reading = useCompositionRead(
    read,
    'Could not read the Corrections of a Correction Type',
    changes,
  );
  return {
    title: editionStrings.dashboard.correctionTypes.tiles[type],
    description: editionStrings.dashboard.correctionTypes.descriptions[type],
    place: Math.max(
      0,
      correctionTypes.tiles.findIndex((tile) => tile.type === type),
    ),
    rows: reading.status === 'ready' ? reading.value : undefined,
    reveal: (correctionId) => {
      void keep('the revealed Corrections', correctionTypes.reveal(correctionId));
    },
  };
}
