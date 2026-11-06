import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { ActionRowLookProvider, ActionTile } from '../primitives/ActionTile';
import { Icon } from '../primitives/Icon';
import { useEdition } from '../providers/EditionProvider';
import { cornerTile } from '../tokens';

/**
 * The actions in an Entry card's top-right corner while marks are swiped
 * (XSwipe bar 6): the heart, the «До колекції» bookmark, each when given, and
 * the «⋯» button that opens the card's menu sheet, each a dark tile with a
 * cream icon, the heart red on it while the Entry is in Favorites.
 */
export function CornerActions({
  favorite,
  collection,
  onMore,
  testID = 'corner-actions',
}: {
  favorite?: ReactNode;
  collection?: ReactNode;
  onMore: () => void;
  testID?: string;
}) {
  const { strings } = useEdition();
  const label = strings.knowledge.swipe.menu.open;
  return (
    <View style={styles.row} testID={testID}>
      <ActionRowLookProvider value="corner">
        {favorite}
        {collection}
        <ActionTile
          label={label}
          accessibilityLabel={label}
          onPress={onMore}
          testID={`${testID}-more`}
          icon={({ size, color }) => <Icon name="more" size={size} color={color} />}
        />
      </ActionRowLookProvider>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: cornerTile.gap },
});
