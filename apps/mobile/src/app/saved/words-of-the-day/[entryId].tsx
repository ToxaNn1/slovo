import { useLocalSearchParams } from 'expo-router';

import { editionStrings } from '@/edition/edition';
import { EntryScreen } from '@/entries/entry-screen';

/**
 * An Entry opened from the Word of the Day archive, which makes nothing Seen
 * (ADR 0054), or a Correction opened from a Word's Entry screen there.
 */
export default function WordOfTheDayEntryScreen() {
  const { entryId, back } = useLocalSearchParams<{ entryId: string; back?: string }>();
  return (
    <EntryScreen
      entryId={entryId}
      back={back ?? editionStrings.wordOfTheDayArchive.title}
      route="/saved/words-of-the-day"
    />
  );
}
