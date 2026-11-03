import type { BadgeCondition } from '@slovo/contracts';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { fill, useEdition } from '../providers/EditionProvider';
import { useTokens } from '../providers/TokensProvider';
import { badgeGrid, typeStyle } from '../tokens';
import { BadgeMark, familyOf, type BadgeFamily } from './BadgeMark';

/** What the grid shows of one Badge. */
export interface BadgeGridItem {
  readonly id: string;
  readonly name: string;
  readonly condition: BadgeCondition;
  readonly symbol: string;
  readonly earned: boolean;
}

/**
 * The Badges as marks in rows, one row for each family in the order the
 * families first come, each Badge in its order, under the family's name and
 * how many of it are earned («3 з 5»). A mark not yet earned is a silhouette.
 * A mark is announced by the Badge's name, with `statusOf` as its value, and
 * pressing it calls `onPress`. The marks take the Profile's size, or the
 * larger one of the Badges screen, where `statusOf` is also written under
 * each mark (`badge-<id>-status`).
 * The marks carry the test IDs `badge-<id>-mark`, a family's count
 * `badge-family-<family>-count`.
 */
export function BadgeGrid<B extends BadgeGridItem>({
  badges,
  onPress,
  statusOf,
  size = 'profile',
}: {
  badges: readonly B[];
  onPress: (badge: B) => void;
  /** What VoiceOver reads after a Badge's name, such as how far its condition has come. */
  statusOf?: (badge: B) => string;
  size?: 'profile' | 'screen';
}) {
  const side = size === 'profile' ? badgeGrid.side : badgeGrid.screenSide;
  const tokens = useTokens();
  const { colors } = tokens;
  const { strings, voice } = useEdition();
  const words = strings.settings.badges;
  const families = new Map<BadgeFamily, B[]>();
  for (const badge of badges) {
    const family = familyOf(badge.condition.kind);
    families.set(family, [...(families.get(family) ?? []), badge]);
  }
  return (
    <View style={styles.grid}>
      {[...families].map(([family, members]) => (
        <View key={family} style={styles.family}>
          <View style={styles.head}>
            <Text
              accessibilityRole="header"
              {...voice}
              style={[typeStyle('badgeFamily', tokens), { color: colors.ink }]}
            >
              {words.families[family]}
            </Text>
            <Text
              testID={`badge-family-${family}-count`}
              {...voice}
              style={[typeStyle('progressCount', tokens), { color: colors.muted }]}
            >
              {fill(words.earnedOf, {
                earned: String(members.filter(({ earned }) => earned).length),
                total: String(members.length),
              })}
            </Text>
          </View>
          <View style={styles.marks}>
            {members.map((badge) => (
              <Pressable
                key={badge.id}
                testID={`badge-${badge.id}`}
                accessibilityRole="button"
                accessibilityLabel={badge.name}
                accessibilityValue={statusOf === undefined ? undefined : { text: statusOf(badge) }}
                accessibilityState={{ disabled: !badge.earned }}
                {...voice}
                onPress={() => {
                  onPress(badge);
                }}
                style={({ pressed }) => [
                  size === 'screen' && styles.cell,
                  pressed && styles.pressed,
                ]}
              >
                <BadgeMark
                  testID={`badge-${badge.id}-mark`}
                  condition={badge.condition}
                  symbol={badge.symbol}
                  earned={badge.earned}
                  size={side}
                />
                {size === 'screen' && statusOf !== undefined && (
                  <Text
                    testID={`badge-${badge.id}-status`}
                    {...voice}
                    style={[
                      typeStyle('badgeProgress', tokens),
                      styles.caption,
                      { color: badge.earned ? colors.ink : colors.muted },
                    ]}
                  >
                    {statusOf(badge)}
                  </Text>
                )}
              </Pressable>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { gap: badgeGrid.familyGap },
  family: { gap: badgeGrid.headGap },
  head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  marks: { flexDirection: 'row', flexWrap: 'wrap', gap: badgeGrid.gap },
  cell: { width: badgeGrid.screenCell, alignItems: 'center', gap: badgeGrid.captionGap },
  caption: { textAlign: 'center' },
  pressed: { transform: [{ scale: badgeGrid.pressedScale }] },
});
