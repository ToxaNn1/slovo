import type { BadgeFamily } from '@slovo/contracts';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { fill, useEdition } from '../providers/EditionProvider';
import { useTokens } from '../providers/TokensProvider';
import { badgeGrid, typeStyle } from '../tokens';
import { BadgeMark } from './BadgeMark';

/** What the grid shows of one Badge. */
export interface BadgeGridItem {
  readonly id: string;
  readonly name: string;
  /** The id of the Badge's family. */
  readonly family: string;
  readonly symbol: string;
  readonly earned: boolean;
}

/**
 * The Badges as marks in rows, one row for each of the Edition's `families`
 * in its order, each Badge in its order, under the family's name and how
 * many of it are earned («3 з 5»); a family with no Badge shown is left out.
 * A mark takes its family's shape and tone; one not yet earned is a
 * silhouette. A mark is announced by the Badge's name, with `statusOf` as
 * its value, and pressing it calls `onPress`. The marks take the Profile's
 * size, five to a row, or the larger one of the Badges screen, where
 * `conditionOf` and `statusOf` are also written under each mark
 * (`badge-<id>-condition`, `badge-<id>-status`).
 * The marks carry the test IDs `badge-<id>-mark`, a family's count
 * `badge-family-<family>-count`.
 */
export function BadgeGrid<B extends BadgeGridItem>({
  families,
  badges,
  onPress,
  statusOf,
  conditionOf,
  size = 'profile',
}: {
  families: readonly BadgeFamily[];
  badges: readonly B[];
  onPress: (badge: B) => void;
  /** What VoiceOver reads after a Badge's name, such as how far its condition has come. */
  statusOf?: (badge: B) => string;
  /** What a Badge's condition asks, written under its mark on the Badges screen. */
  conditionOf?: (badge: B) => string;
  size?: 'profile' | 'screen';
}) {
  const side = size === 'profile' ? badgeGrid.side : badgeGrid.screenSide;
  const tokens = useTokens();
  const { colors } = tokens;
  const { strings, voice } = useEdition();
  const words = strings.settings.badges;
  const rows = families.flatMap((family) => {
    const members = badges.filter((badge) => badge.family === family.id);
    return members.length === 0 ? [] : [{ family, members }];
  });
  return (
    <View style={styles.grid}>
      {rows.map(({ family, members }) => (
        <View key={family.id} style={styles.family}>
          <View style={styles.head}>
            <Text
              accessibilityRole="header"
              {...voice}
              style={[typeStyle('badgeFamily', tokens), { color: colors.ink }]}
            >
              {family.name}
            </Text>
            <Text
              testID={`badge-family-${family.id}-count`}
              {...voice}
              style={[typeStyle('progressCount', tokens), { color: colors.muted }]}
            >
              {fill(words.earnedOf, {
                earned: String(members.filter(({ earned }) => earned).length),
                total: String(members.length),
              })}
            </Text>
          </View>
          <View style={size === 'profile' ? styles.marks : styles.screenMarks}>
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
                  shape={family.shape}
                  tone={family.tone}
                  symbol={badge.symbol}
                  earned={badge.earned}
                  size={side}
                />
                {size === 'screen' && conditionOf !== undefined && (
                  <Text
                    testID={`badge-${badge.id}-condition`}
                    {...voice}
                    style={[
                      typeStyle('badgeProgress', tokens),
                      styles.caption,
                      { color: colors.ink },
                    ]}
                  >
                    {conditionOf(badge)}
                  </Text>
                )}
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
  marks: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: badgeGrid.gap,
    maxWidth: badgeGrid.columns * badgeGrid.side + (badgeGrid.columns - 1) * badgeGrid.gap,
  },
  screenMarks: { flexDirection: 'row', flexWrap: 'wrap', gap: badgeGrid.screenGap },
  cell: { width: badgeGrid.screenCell, alignItems: 'center', gap: badgeGrid.captionGap },
  caption: { textAlign: 'center' },
  pressed: { transform: [{ scale: badgeGrid.pressedScale }] },
});
