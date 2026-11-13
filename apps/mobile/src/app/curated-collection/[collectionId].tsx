import { fill } from '@slovo/contracts';
import {
  categoryTile,
  knownShare,
  RailBoard,
  RailScreenHero,
  shapeAt,
  useEdition,
} from '@slovo/ui';
import { Redirect, useRouter } from 'expo-router';

import { useCuratedCollectionScreen } from '@/dashboard/curated-collection';
import { editionStrings } from '@/edition/edition';
import { ReadFailed } from '@/read-failed';
import { useSegmentParam } from '@/route-params';

const { curatedCollection: words, curatedCollectionCount } = editionStrings.dashboard;

/**
 * A Curated Collection's screen, from its card on the Dashboard, as the
 * board's «cat» screen draws it: the red hero with «Додати», its Entries as
 * cards under it. An id with no screen returns home; a failed read shows
 * the error with its retry.
 */
export default function CuratedCollectionRoute() {
  const collectionId = useSegmentParam('collectionId');
  const { screen, retry, place, add, openEntry } = useCuratedCollectionScreen(collectionId);
  const { count } = useEdition();
  const router = useRouter();
  if (screen === null) return <Redirect href="/" />;
  if (retry !== undefined)
    return (
      <ReadFailed
        back={{ testID: 'curated-collection-back', label: editionStrings.tabs.home }}
        onRetry={retry}
        testID="curated-collection-error"
      />
    );
  const [glyph] = shapeAt(categoryTile.shapes, place);
  const { known, total, done } = knownShare(screen?.entries ?? []);
  return (
    <RailBoard
      testID="curated-collection"
      cards={screen?.entries ?? []}
      onOpen={openEntry}
      hero={
        <RailScreenHero
          id="curated-collection-hero"
          glyph={glyph}
          kicker={fill(words.kicker, { count: count(curatedCollectionCount, total) })}
          title={screen?.collection.name ?? ''}
          description={screen?.collection.description ?? ''}
          progress={fill(words.known, { x: String(known), n: String(total) })}
          done={done}
          mascot="waits"
          back={{
            testID: 'curated-collection-back',
            label: editionStrings.tabs.home,
            onPress: () => {
              router.back();
            },
          }}
          {...(screen !== undefined && {
            action: {
              kind: 'toggle',
              testID: 'curated-collection-add',
              label: screen.added ? words.addedButton : words.addButton,
              on: screen.added,
              onPress: () => {
                if (!screen.added) add();
              },
            },
          })}
        />
      }
    />
  );
}
