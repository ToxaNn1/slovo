import { useLocalSearchParams } from 'expo-router';

import { editionStrings } from '@/edition/edition';
import { openedFromOf } from '@/entries/entry-link';
import { EntryScreen } from '@/entries/entry-screen';

/**
 * An Entry opened from a link, `slovo-<edition id>://entry/<id>`, or from the
 * Feed. A notification's link opens its Word and the widget's link its Entry,
 * which the Entry screen opens as Seen; a Correction its Word card links opens
 * over it without. A notification tapped or a widget link opened over any of
 * them takes the place of the whole stack (`NotificationTaps`).
 */
export default function EntryFromLinkScreen() {
  const { entryId, back, ...params } = useLocalSearchParams<{
    entryId: string;
    back?: string;
    from?: string;
  }>();
  return (
    <EntryScreen
      entryId={entryId}
      back={back ?? editionStrings.tabs.home}
      route="/entry"
      openedFrom={openedFromOf(params)}
    />
  );
}
