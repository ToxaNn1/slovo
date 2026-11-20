import { fill } from '@slovo/contracts';
import {
  curatedCollectionGlyph,
  knownShare,
  RailBoard,
  type RailBoardCard,
  RailScreenHero,
  UndoToastProvider,
  useEdition,
  useListScroll,
} from '@slovo/ui';
import { Redirect, useRouter } from 'expo-router';
import type { FlatList } from 'react-native';

import { useCuratedCollectionScreen } from '@/dashboard/curated-collection';
import { editionStrings } from '@/edition/edition';
import { ReadFailed } from '@/read-failed';
import { useSegmentParam } from '@/route-params';
import { ListTopButton } from '@/shell/list-top';

const { curatedCollection: words, curatedCollectionCount } = editionStrings.dashboard;

/**
 * A Curated Collection's screen, from its card on the Dashboard, as the
 * board's «cat» screen draws it: the red hero with «Додати», its Entries as
 * cards under it. An id with no screen returns home; a failed read shows
 * the error with its retry.
 */
export default function CuratedCollectionRoute() {
  return (
    <UndoToastProvider>
      <CuratedCollectionScreen collectionId={useSegmentParam('collectionId')} />
    </UndoToastProvider>
  );
}

function CuratedCollectionScreen({ collectionId }: { collectionId: string }) {
  const { screen, retry, pictogram, add, openCopy, openEntry } =
    useCuratedCollectionScreen(collectionId);
  const { count } = useEdition();
  const router = useRouter();
  const scroll = useListScroll<FlatList<RailBoardCard>>();
  if (screen === null) return <Redirect href="/" />;
  if (retry !== undefined)
    return (
      <ReadFailed
        back={{ testID: 'curated-collection-back', label: editionStrings.back }}
        onRetry={retry}
        testID="curated-collection-error"
      />
    );
  const { known, total, done } = knownShare(screen?.entries ?? []);
  return (
    <RailBoard
      testID="curated-collection"
      cards={screen?.entries ?? []}
      onOpen={openEntry}
      scroll={scroll}
      corner={<ListTopButton scroll={scroll} />}
      hero={
        <RailScreenHero
          id="curated-collection-hero"
          glyph={curatedCollectionGlyph(pictogram)}
          kicker={fill(words.kicker, { count: count(curatedCollectionCount, total) })}
          title={screen?.collection.name ?? ''}
          description={screen?.collection.description ?? ''}
          progress={fill(words.known, { x: String(known), n: String(total) })}
          done={done}
          mascot="waits"
          back={{
            testID: 'curated-collection-back',
            label: editionStrings.back,
            onPress: () => {
              router.back();
            },
          }}
          {...(screen !== undefined && {
            action: screen.added
              ? {
                  kind: 'opens',
                  testID: 'curated-collection-add',
                  label: words.addedButton,
                  hint: words.openCopyHint,
                  onPress: openCopy,
                }
              : {
                  kind: 'toggle',
                  testID: 'curated-collection-add',
                  label: words.addButton,
                  on: false,
                  onPress: add,
                },
          })}
        />
      }
    />
  );
}
