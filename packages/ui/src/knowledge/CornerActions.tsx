import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { ActionRowLookProvider } from '../primitives/ActionTile';
import { IconButton } from '../primitives/IconButton';
import { useEdition } from '../providers/EditionProvider';

/**
 * The actions in an Entry card's top-right corner while marks are swiped
 * (XSwipe): the heart, the «До колекції» bookmark, each when given, as bare
 * icons, and the «⋯» button that opens the card's menu sheet.
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
  return (
    <View style={styles.row} testID={testID}>
      <ActionRowLookProvider value="icons">
        {favorite}
        {collection}
      </ActionRowLookProvider>
      <IconButton
        icon="more"
        accessibilityLabel={strings.knowledge.swipe.menu.open}
        onPress={onMore}
        testID={`${testID}-more`}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
});
