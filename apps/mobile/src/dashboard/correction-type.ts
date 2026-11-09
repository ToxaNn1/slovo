import type { CorrectionType } from '@slovo/contracts';
import type { Composition, CorrectionTypeRow } from '@slovo/core';
import { useEffect, useState } from 'react';

import { useComposition } from '../composition';
import { logError } from '../diagnostics/log';
import { keep } from '../keep';
import { editionStrings } from '../edition/edition';

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
  /** «Як правильно?»: marks the Correction worked through, which reveals it in place. */
  readonly reveal: (correctionId: string) => void;
}

/**
 * A Correction Type's screen (ADR 0076): its Corrections, read again each
 * time the tiles change, so a Correction revealed here or Seen on the Feed
 * shows its standard form.
 */
export function useCorrectionTypeScreen(type: CorrectionType): CorrectionTypeScreen {
  const composition = useComposition();
  const { correctionTypes } = composition;
  const [read, setRead] = useState<{
    in: Composition;
    type: CorrectionType;
    rows: readonly CorrectionTypeRow[];
  }>();
  useEffect(() => {
    let active = true;
    // Only the latest read is shown: an earlier one that ends after it is dropped.
    let latest = 0;
    const reread = () => {
      latest += 1;
      const mine = latest;
      correctionTypes.corrections(type).then(
        (rows) => {
          if (active && mine === latest) setRead({ in: composition, type, rows });
        },
        (error: unknown) => {
          logError('Could not read the Corrections of a Correction Type', error);
        },
      );
    };
    reread();
    const stop = correctionTypes.subscribe(reread);
    return () => {
      active = false;
      stop();
    };
  }, [composition, correctionTypes, type]);
  return {
    title: editionStrings.dashboard.correctionTypes.tiles[type],
    description: editionStrings.dashboard.correctionTypes.descriptions[type],
    place: Math.max(
      0,
      correctionTypes.tiles.findIndex((tile) => tile.type === type),
    ),
    // A read of a composition since reopened, or of another type, is not shown.
    rows: read?.in === composition && read.type === type ? read.rows : undefined,
    reveal: (correctionId) => {
      void keep('the revealed Corrections', correctionTypes.reveal(correctionId));
    },
  };
}
