import { editionStrings } from '@/edition/edition';
import { SavedListScreen } from '@/saved/saved-list-screen';
import { WordOfTheDayArchiveList } from '@/saved/word-of-the-day-archive-list';

const { wordOfTheDayArchive: strings } = editionStrings;

/** «Слова дня» on its own screen: a back link to Saved and the title over the list. */
export default function WordOfTheDayArchiveScreen() {
  return (
    <SavedListScreen
      name="words-of-the-day"
      title={strings.title}
      aside={{ kind: 'none' }}
      list={(header) => <WordOfTheDayArchiveList header={header} />}
    />
  );
}
