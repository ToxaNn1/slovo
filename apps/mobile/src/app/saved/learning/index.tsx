import { Redirect } from 'expo-router';

import { editionStrings } from '@/edition/edition';
import { useLearningList } from '@/saved/learning';
import { LearningList } from '@/saved/learning-list';
import { SavedListScreen } from '@/saved/saved-list-screen';
import { useShown } from '@/shown-in-effect';

const { learning: strings } = editionStrings;

/**
 * The «Вчу» list on its own screen, while Knowledge Marks are on in effect:
 * a back link to Saved, the title with how many Entries it holds, then the list.
 */
export default function LearningScreen() {
  // Turned off remotely while the reader is on it: its tab goes, and so does the screen.
  if (!useShown().learning) return <Redirect href="/saved" />;
  return <Learning />;
}

function Learning() {
  const list = useLearningList();
  return (
    <SavedListScreen
      name="learning"
      title={strings.title}
      aside={{ kind: 'count', value: list.length, forms: strings.count }}
      list={(header) => <LearningList header={header} />}
    />
  );
}
