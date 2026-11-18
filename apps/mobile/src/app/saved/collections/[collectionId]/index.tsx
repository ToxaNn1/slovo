import { CollectionBoardScreen } from '@/saved/collection-board';
import { useQueryParam, useSegmentParam } from '@/route-params';

/**
 * A Collection in the board style (ADR 0132). `?created=1` marks the
 * Collection just made from the Collections grid.
 */
export default function CollectionScreen() {
  const collectionId = useSegmentParam('collectionId');
  const created = useQueryParam('created') === '1';
  return <CollectionBoardScreen collectionId={collectionId} created={created} />;
}
