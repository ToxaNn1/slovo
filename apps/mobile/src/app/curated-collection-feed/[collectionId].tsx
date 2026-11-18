import { Redirect } from 'expo-router';

import { CuratedCollectionFeedScreen } from '@/dashboard/curated-collection-feed';
import { useQueryParam, useSegmentParam } from '@/route-params';
import { useShown } from '@/shown-in-effect';

/**
 * A Curated Collection's Feed, from a tap on an Entry of its screen (ADR
 * 0178), opened on the Entry `from`. With `curatedCollectionFeed` off it
 * returns to the Dashboard.
 */
export default function CuratedCollectionFeedRoute() {
  const collectionId = useSegmentParam('collectionId');
  const from = useQueryParam('from');
  const { curatedCollectionFeed } = useShown();
  if (!curatedCollectionFeed) return <Redirect href="/" />;
  return <CuratedCollectionFeedScreen collectionId={collectionId} from={from ?? ''} />;
}
