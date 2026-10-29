import type { CollectionShareRefusal } from '@slovo/core';
import { useUndoToast } from '@slovo/ui';
import { useCallback, useEffect, useRef } from 'react';
import { Share } from 'react-native';

import { useComposition } from '../composition';
import { logError } from '../diagnostics/log';
import { editionStrings } from '../edition/edition';

const strings = editionStrings.collections.link;

/** What the toast says when a Collection is not shared: no connection, too many Entries, or that it failed. */
function refusalText(reason: CollectionShareRefusal): string {
  switch (reason) {
    case 'offline':
      return strings.offline;
    case 'too-many-entries':
      return strings.tooManyEntries;
    case 'switched-off':
    case 'empty':
    case 'too-many-requests':
    case 'failed':
      return strings.failed;
  }
}

/**
 * «Поділитися посиланням» of a Collection's menu (ADR 0058): whether the menu
 * offers it, while `collectionLinks` is on in effect, and the share, which
 * asks the backend for a link and opens the system share sheet with the
 * message, or shows a toast that says why not, such as «Немає з'єднання.
 * Спробуйте пізніше.». `share` stays the same from render to render and
 * shares over the composition open at the tap. It needs an `UndoToastProvider`
 * above it.
 */
export function useCollectionSharing(): {
  available: boolean;
  share: (collectionId: string) => void;
} {
  const sharing = useComposition().collectionSharing;
  const showToast = useUndoToast();
  const latest = useRef(sharing);
  useEffect(() => {
    latest.current = sharing;
  }, [sharing]);
  const share = useCallback(
    (collectionId: string) => {
      void latest.current.share(collectionId, strings).then(async (shared) => {
        if (!shared.ok) {
          showToast({ message: refusalText(shared.reason) });
          return;
        }
        try {
          await Share.share({ message: shared.message });
        } catch (error) {
          logError('Could not open the share sheet for a Collection Link', error);
        }
      });
    },
    [showToast],
  );
  return { available: sharing.available(), share };
}
