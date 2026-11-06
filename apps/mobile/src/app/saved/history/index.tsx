import { fill } from '@slovo/ui';
import { HISTORY_CAP } from '@slovo/core';

import { editionStrings } from '@/edition/edition';
import { HistoryList } from '@/saved/history-list';
import { SavedListScreen } from '@/saved/saved-list-screen';

const { history: strings } = editionStrings;

/** History on its own screen: a back link to Saved and «Очистити», the title with how many Entries History keeps, then the list. */
export default function HistoryScreen() {
  return (
    <SavedListScreen
      name="history"
      title={strings.title}
      aside={{
        kind: 'note',
        text: fill(strings.limit, { count: String(HISTORY_CAP) }),
        testID: 'history-limit',
      }}
      list={(header) => <HistoryList header={header} />}
    />
  );
}
