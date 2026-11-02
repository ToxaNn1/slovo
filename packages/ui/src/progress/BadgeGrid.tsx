import type { BadgeCondition } from '@slovo/contracts';
import { Pressable, StyleSheet, View } from 'react-native';

import { badgeGrid } from '../tokens';
import { BadgeMark, shapeOf, type BadgeShape } from './BadgeMark';

/** What the grid shows of one Badge. */
export interface BadgeGridItem {
  readonly id: string;
  readonly name: string;
  readonly condition: BadgeCondition;
  readonly symbol: string;
  readonly earned: boolean;
}

/**
 * The Badges as marks in rows, one row for each family's shape in the order
 * the families first come, each Badge in its order. A mark is announced by the
 * Badge's name and pressing it calls `onPress`. The marks carry the test IDs
 * `badge-<id>-mark`.
 */
export function BadgeGrid<B extends BadgeGridItem>({
  badges,
  onPress,
}: {
  badges: readonly B[];
  onPress: (badge: B) => void;
}) {
  const families = new Map<BadgeShape, B[]>();
  for (const badge of badges) {
    const shape = shapeOf(badge.condition.kind);
    families.set(shape, [...(families.get(shape) ?? []), badge]);
  }
  return (
    <View style={styles.grid}>
      {[...families.values()].map((family) => (
        <View key={family[0]?.id} style={styles.family}>
          {family.map((badge) => (
            <Pressable
              key={badge.id}
              testID={`badge-${badge.id}`}
              accessibilityRole="button"
              accessibilityLabel={badge.name}
              accessibilityState={{ disabled: !badge.earned }}
              onPress={() => {
                onPress(badge);
              }}
              style={({ pressed }) => pressed && styles.pressed}
            >
              <BadgeMark
                testID={`badge-${badge.id}-mark`}
                condition={badge.condition}
                symbol={badge.symbol}
                earned={badge.earned}
                size={badgeGrid.side}
              />
            </Pressable>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { gap: badgeGrid.familyGap },
  family: { flexDirection: 'row', flexWrap: 'wrap', gap: badgeGrid.gap },
  pressed: { transform: [{ scale: badgeGrid.pressedScale }] },
});
