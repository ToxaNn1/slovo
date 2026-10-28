import type { Composition, CollectionLinkPreview } from '@slovo/core';
import { useCallback } from 'react';

import { useCompositionRead } from '../composition';

/**
 * The Collection Link of the id as its recipient sheet shows it: the Core's
 * preview with «Додати собі», or why not (ADR 0058). Nothing until the read,
 * which goes through the one retry rule, ends.
 */
export function useCollectionLinkPreview(linkId: string): CollectionLinkPreview | undefined {
  const read = useCallback(
    (composition: Composition) => composition.collectionLinkCopy.preview(linkId),
    [linkId],
  );
  return useCompositionRead(read, 'Could not read the Collection Link');
}
