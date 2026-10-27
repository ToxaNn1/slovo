import { useLocalSearchParams } from 'expo-router';

import { editionStrings } from '@/edition/edition';
import { EntryScreen } from '@/entries/entry-screen';

/**
 * An Entry a Search result opens, which makes nothing Seen (ADR 0054); a
 * Correction, a Synonym Row or a Word its card links opens over it the same way.
 */
export default function EntryFromSearchScreen() {
  const { entryId, back } = useLocalSearchParams<{ entryId: string; back?: string }>();
  return (
    <EntryScreen
      entryId={entryId}
      back={back ?? editionStrings.search.title}
      route="/search"
      openedFrom="search"
    />
  );
}
