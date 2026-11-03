import { ActionIcon, ActionTile } from '../primitives/ActionTile';
import { useEdition } from '../providers/EditionProvider';

/** The design's bookmark with a plus in it, on a 24-point grid. */
const BOOKMARK_ICON = { outline: 'M6 3h12v18l-6-4.5L6 21z', inner: 'M12 7v6M9 10h6' };

/** The same bookmark, filled, with a check in place of the plus once the Entry is filed. */
const FILED_ICON = { outline: BOOKMARK_ICON.outline, inner: 'M9 10.5l2.2 2.2L15.5 8' };

/**
 * The Collections action of the action row: a bookmark with a plus,
 * «До колекції», which opens the «До колекції» sheet. Once the Entry is in
 * a Collection the bookmark is filled with a check, «У колекції».
 * VoiceOver reads what a tap will do, and the filed state as selected.
 */
export function CollectionButton({
  filed,
  onPress,
  testID = 'collection-button',
}: {
  /** Whether the Entry is in at least one Collection. */
  filed: boolean;
  onPress: () => void;
  testID?: string;
}) {
  const { strings } = useEdition();
  const { tile } = strings.collections;
  return (
    <ActionTile
      label={filed ? tile.filed : tile.add}
      accessibilityLabel={strings.collections.button}
      mark={filed ? 'filed' : 'none'}
      onPress={onPress}
      testID={testID}
      icon={(look) => <ActionIcon paths={filed ? FILED_ICON : BOOKMARK_ICON} look={look} />}
    />
  );
}
