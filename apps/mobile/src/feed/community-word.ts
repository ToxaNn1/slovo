import type { EntryRowModel } from '@slovo/core';
import { useEffect, useState } from 'react';

import { useComposition } from '../composition';
import { logError } from '../diagnostics/log';

/**
 * The row of the Community Word's Entry, read once its card is drawn, which
 * its mini card shows; nothing until it is read.
 */
export function useCommunityWordRow(entryId: string): EntryRowModel | undefined {
  const composition = useComposition();
  const [row, setRow] = useState<EntryRowModel>();
  useEffect(() => {
    let active = true;
    composition.entryRow(entryId).then(
      (model) => {
        if (active) setRow(model);
      },
      (error: unknown) => {
        logError('Could not read the Community Word', error);
      },
    );
    return () => {
      active = false;
    };
  }, [composition, entryId]);
  return row?.entryId === entryId ? row : undefined;
}
