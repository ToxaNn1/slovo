import { useLocalSearchParams } from 'expo-router';

import { editionStrings } from '@/edition/edition';
import { EntryScreen } from '@/entries/entry-screen';

/** An Entry opened from the «Вчу» list, or a Correction opened from a Word's Entry screen there. */
export default function LearningEntryScreen() {
  const { entryId, back } = useLocalSearchParams<{ entryId: string; back?: string }>();
  return (
    <EntryScreen
      entryId={entryId}
      back={back ?? editionStrings.learning.title}
      route="/saved/learning"
    />
  );
}
