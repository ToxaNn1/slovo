import { useLocalSearchParams } from 'expo-router';

import { editionStrings } from '@/edition/edition';
import { EntryScreen } from '@/entries/entry-screen';

/** An Entry opened from History, or a Correction opened from a Word's Entry screen there. */
export default function HistoryEntryScreen() {
  const { entryId, back } = useLocalSearchParams<{ entryId: string; back?: string }>();
  return (
    <EntryScreen
      entryId={entryId}
      back={back ?? editionStrings.history.title}
      route="/saved/history"
    />
  );
}
