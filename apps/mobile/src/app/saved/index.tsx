import { Placeholder } from '@slovo/ui';

import { editionStrings } from '../../edition';

/** The Saved overview: a placeholder until the 0.3 overview fills it. */
export default function SavedScreen() {
  return <Placeholder testID="saved-placeholder" message={editionStrings.placeholder} />;
}
