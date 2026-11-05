import type { CorrectionType } from '@slovo/contracts';
import type { Composition, CorrectionTypeRow } from '@slovo/core';
import { useEffect, useState } from 'react';

import { useComposition } from '../composition';
import { logError } from '../diagnostics/log';
import { editionStrings } from '../edition/edition';

/** What a Correction Type's screen draws and does. */
export interface CorrectionTypeScreen {
  /** The tile's name, «Суржик». */
  readonly title: string;
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
    const reread = () => {
      correctionTypes.corrections(type).then(
        (rows) => {
          if (active) setRead({ in: composition, type, rows });
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
    // A read of a composition since reopened, or of another type, is not shown.
    rows: read?.in === composition && read.type === type ? read.rows : undefined,
    reveal: (correctionId) => {
      void correctionTypes.reveal(correctionId);
    },
  };
}
