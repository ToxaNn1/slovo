import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { cornerTile } from '../tokens';

/**
 * The top line of an Entry card's body. With no `corner` it is the card's
 * kicker alone, if it has one. With the corner actions (XSwipe bar 6) the
 * kicker takes the room left of them in one row, the tiles at its right end
 * at their own width, so they never cover a word of it; a card with no
 * kicker keeps the row, the tiles alone at its right, over its headline.
 */
export function KickerRow({
  testID,
  corner,
  children,
}: {
  testID: string;
  corner: ReactNode | undefined;
  children?: ReactNode;
}) {
  if (corner === undefined) return children;
  return (
    <View testID={testID} style={styles.row}>
      <View style={styles.kicker}>{children}</View>
      {corner}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: cornerTile.kickerGap,
    minHeight: cornerTile.side,
  },
  kicker: { flex: 1, minWidth: 0 },
});
