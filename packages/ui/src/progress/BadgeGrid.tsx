import type { BadgeFamily } from '@slovo/contracts';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { fill, useEdition } from '../providers/EditionProvider';
import { useTokens } from '../providers/TokensProvider';
import { badgeGrid, typeStyle } from '../tokens';
import { BadgeMark, type BadgeMarkState } from './BadgeMark';

/** What the grid shows of one Badge: earned and maybe new, or not yet, with its progress. */
export type BadgeGridItem = {
  readonly id: string;
  readonly name: string;
  /** The id of the Badge's family. */
  readonly family: string;
  readonly symbol: string;
} & (
  | { readonly earned: true; readonly isNew: boolean }
  | {
      readonly earned: false;
      readonly progress: { readonly current: number; readonly target: number };
    }
);

/** The mark's state of a Badge: earned, in progress by its fraction, or not started. */
export function markStateOf(badge: BadgeGridItem): BadgeMarkState {
  if (badge.earned) return { kind: 'earned', isNew: badge.isNew };
  const { current, target } = badge.progress;
  return current > 0
    ? { kind: 'progress', fraction: Math.min(1, current / target) }
    : { kind: 'locked' };
}

/**
 * The Badges in rows, one row for each of the Edition's `families` in its
 * order, each Badge in its order, under the family's name and how many of it
 * are earned («3 з 5»); a family with no Badge shown is left out. A mark
 * takes its family's shape and tone; one not yet earned is a silhouette,
 * filled by its progress; an earned one not yet opened carries «НОВА». A
 * Badge is announced by its name, with `statusOf` as its value, and pressing
 * it calls `onPress`. On the Profile the marks stand five to a row; on the
 * Badges screen each Badge is a card (ADR 0145): its mark at 96 over its
 * name, `conditionOf` and `statusOf` (`badge-<id>-name`,
 * `badge-<id>-condition`, `badge-<id>-status`).
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
  const screen = size === 'screen';
  const tokens = useTokens();
  const { colors } = tokens;
  const { strings, voice } = useEdition();
  const words = strings.settings.badges;
  const rows = families.flatMap((family) => {
    const members = badges.filter((badge) => badge.family === family.id);
    return members.length === 0 ? [] : [{ family, members }];
  });
  return (
    <View style={screen ? styles.screenGrid : styles.grid}>
      {rows.map(({ family, members }) => (
        <View key={family.id} style={screen ? styles.screenFamily : styles.family}>
          <View style={styles.head}>
            <Text
              accessibilityRole="header"
              {...voice}
              style={[
                typeStyle(screen ? 'badgeScreenFamily' : 'badgeFamily', tokens),
                { color: colors.ink },
              ]}
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
          <View style={screen ? styles.cards : styles.marks}>
            {members.map((badge) => (
              <Pressable
                key={badge.id}
                testID={`badge-${badge.id}`}
                accessibilityRole="button"
                accessibilityLabel={badge.name}
                accessibilityValue={statusOf === undefined ? undefined : { text: statusOf(badge) }}
                {...voice}
                onPress={() => {
                  onPress(badge);
                }}
                style={({ pressed }) => [
                  screen && [
                    styles.card,
                    {
                      backgroundColor: colors.tile,
                      borderColor: colors.line,
                      boxShadow: `0 ${String(badgeGrid.card.edge)}px 0 ${colors.tileEdge}`,
                    },
                  ],
                  pressed && styles.pressed,
                ]}
              >
                <BadgeMark
                  testID={`badge-${badge.id}-mark`}
                  shape={family.shape}
                  tone={family.tone}
                  symbol={badge.symbol}
                  state={markStateOf(badge)}
                  size={screen ? badgeGrid.card.mark : badgeGrid.side}
                />
                {screen && (
                  <Text
                    testID={`badge-${badge.id}-name`}
                    {...voice}
                    style={[
                      typeStyle('badgeCardName', tokens),
                      styles.caption,
                      { color: colors.ink },
                    ]}
                  >
                    {badge.name}
                  </Text>
                )}
                {screen && conditionOf !== undefined && (
                  <Text
                    testID={`badge-${badge.id}-condition`}
                    {...voice}
                    style={[
                      typeStyle('badgeCardCondition', tokens),
                      styles.caption,
                      { color: colors.muted },
                    ]}
                  >
                    {conditionOf(badge)}
                  </Text>
                )}
                {screen && statusOf !== undefined && (
                  <Text
                    testID={`badge-${badge.id}-status`}
                    {...voice}
                    style={[
                      typeStyle('badgeCardStatus', tokens),
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
  screenGrid: { gap: badgeGrid.screen.familyGap },
  screenFamily: { gap: badgeGrid.screen.headGap },
  cards: { flexDirection: 'row', flexWrap: 'wrap', gap: badgeGrid.screen.cardGap },
  card: {
    flexBasis: badgeGrid.card.basis,
    flexGrow: 1,
    maxWidth: badgeGrid.card.width,
    alignItems: 'center',
    gap: badgeGrid.card.gap,
    paddingTop: badgeGrid.card.paddingTop,
    paddingHorizontal: badgeGrid.card.paddingX,
    paddingBottom: badgeGrid.card.paddingBottom,
    borderRadius: badgeGrid.card.radius,
    borderWidth: badgeGrid.card.border,
  },
  caption: { textAlign: 'center' },
  pressed: { transform: [{ scale: badgeGrid.pressedScale }] },
});
