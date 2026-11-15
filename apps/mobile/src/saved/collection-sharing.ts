import type { CollectionShareRefusal } from '@slovo/core';
import { useUndoToast } from '@slovo/ui';
import * as Clipboard from 'expo-clipboard';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Share } from 'react-native';

import { useComposition } from '../composition';
import { logError } from '../diagnostics/log';
import { editionStrings } from '../edition/edition';
import { useEditionInEffect } from '../edition/remote-switches';

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
 * Спробуй пізніше.». `share` stays the same from render to render and
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

/** What the share sheet of a Collection (board 09) takes from the screen that opens it. */
export interface CollectionShareSheetProps {
  readonly url: string;
  readonly copy: (typeof editionStrings)['collections']['shareSheet'];
  readonly onCopy: (() => void) | undefined;
  readonly onShare: () => void;
  readonly onClose: () => void;
  readonly onDismissed: () => void;
}

/**
 * «Поділитися посиланням» of board 09 (ADR 0132): `share` asks the backend
 * for a Collection Link as `useCollectionSharing` does, then opens the share
 * sheet with it, or shows the toast that says why not. On the sheet
 * «Скопіювати посилання», while `collectionLinkCopy` is on in effect, copies
 * the link with `expo-clipboard` and says «Посилання скопійовано.»; «Поділитися»
 * opens the system share sheet with the message once the sheet has slid away
 * (two modals do not show together). It needs an `UndoToastProvider` above it.
 */
export function useCollectionShareSheet(): {
  available: boolean;
  /** Whether a link is on the way from the backend, a tap away from the share sheet or the toast. */
  busy: boolean;
  share: (collectionId: string) => void;
  sheet: CollectionShareSheetProps;
} {
  const sharing = useComposition().collectionSharing;
  const canCopy = useEditionInEffect().isFeatureEnabled('collectionLinkCopy');
  const showToast = useUndoToast();
  const latest = useRef(sharing);
  useEffect(() => {
    latest.current = sharing;
  }, [sharing]);
  const [shared, setShared] = useState<{ readonly url: string; readonly message: string }>();
  /** The message for the system share sheet, once the share sheet has slid away. */
  const toShare = useRef<string>(undefined);
  const [busy, setBusy] = useState(false);
  const share = useCallback(
    (collectionId: string) => {
      setBusy(true);
      void latest.current.share(collectionId, strings).then((made) => {
        setBusy(false);
        if (made.ok) setShared({ url: made.url, message: made.message });
        else showToast({ message: refusalText(made.reason) });
      });
    },
    [showToast],
  );
  const close = () => {
    setShared(undefined);
  };
  return {
    available: sharing.available(),
    busy,
    share,
    sheet: {
      url: shared?.url ?? '',
      copy: editionStrings.collections.shareSheet,
      onCopy:
        canCopy && shared !== undefined
          ? () => {
              const { url } = shared;
              close();
              Clipboard.setStringAsync(url).then(
                () => {
                  showToast({ look: 'plate', message: editionStrings.collections.toasts.copied });
                },
                (error: unknown) => {
                  logError('Could not copy a Collection Link', error);
                },
              );
            }
          : undefined,
      onShare: () => {
        toShare.current = shared?.message;
        close();
      },
      onClose: close,
      onDismissed: () => {
        const message = toShare.current;
        toShare.current = undefined;
        if (message === undefined) return;
        Share.share({ message }).catch((error: unknown) => {
          logError('Could not open the share sheet for a Collection Link', error);
        });
      },
    },
  };
}
