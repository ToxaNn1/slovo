import { useLocalSearchParams } from 'expo-router';

import { editionStrings } from '../../edition';
import { openedFromOf } from '../../entry-link';
import { EntryScreen } from '../../entry-screen';

/**
 * An Entry opened from a link, `slovo-<edition id>://entry/<id>`. A
 * notification's link opens its Word and the widget's link its Entry, which
 * the Entry screen opens as Seen; a Correction its Word card links opens over
 * it without.
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
