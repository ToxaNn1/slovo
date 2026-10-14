import { useLocalSearchParams } from 'expo-router';

import { editionStrings } from '../../edition';
import { EntryScreen } from '../../entry-screen';

/**
 * An Entry opened from a link, `slovo-<edition id>://entry/<id>`. With
 * `?from=notification` it is a notification's Word, which the Entry screen
 * opens as Seen; a Correction its Word card links opens over it without.
 */
export default function EntryFromLinkScreen() {
  const { entryId, back, from } = useLocalSearchParams<{
    entryId: string;
    back?: string;
    from?: string;
  }>();
  return (
    <EntryScreen
      entryId={entryId}
      back={back ?? editionStrings.tabs.home}
      route="/entry"
      fromNotification={from === 'notification'}
    />
  );
}
