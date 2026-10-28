import { openCollectionSharing, systemRandom, type CollectionShareRefusal } from '@slovo/core';
import { systemSchedule, useUndoToast } from '@slovo/ui';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Share } from 'react-native';

import { apiClient } from '../api';
import { useComposition } from '../composition';
import { logError } from '../diagnostics/log';
import { editionStrings } from '../edition/edition';
import { useEditionInEffect } from '../edition/remote-switches';
import { createCollectionLinksApi } from './collection-links-api';

const strings = editionStrings.collections.link;

const collectionLinksApi = createCollectionLinksApi({ client: apiClient });

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
  const { collections } = useComposition();
  const edition = useEditionInEffect();
  const showToast = useUndoToast();
  const sharing = useMemo(
    () =>
      openCollectionSharing({
        collections,
        api: collectionLinksApi,
        edition,
        strings,
        schedule: systemSchedule,
        random: systemRandom,
      }),
    [collections, edition],
  );
  const latest = useRef(sharing);
  useEffect(() => {
    latest.current = sharing;
  }, [sharing]);
  const share = useCallback(
    (collectionId: string) => {
      void latest.current.share(collectionId).then(async (shared) => {
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
