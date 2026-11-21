import type { BadgeFamily } from '@slovo/contracts';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { useEdition } from '../providers/EditionProvider';
import { useTokens } from '../providers/TokensProvider';
import { badgeFamilies, typeStyle } from '../tokens';
import type { BadgeGridItem } from './BadgeGrid';
import { BadgeMark } from './BadgeMark';

/**
 * The Badge families overview heading the Badges screen (`XBadges` fams): a card for each of the Edition's `families` that holds a Badge,
 * in its order, in a row that scrolls sideways. A card shows the family's
 * mark (its shape and tone, earned, with its first Badge's symbol), its name
 * as a header, how many Badges it holds («5 відзнак»), its description and
 * its shape («ФОРМА · Шестикутник»). Test IDs: `badge-families-<family>`,
 * with `-count`, `-description`, `-shape` and the mark `-mark`.
 */
export function BadgeFamilies({
  families,
  badges,
}: {
  families: readonly BadgeFamily[];
  badges: readonly BadgeGridItem[];
}) {
  const tokens = useTokens();
  const { colors } = tokens;
  const { strings, voice, count } = useEdition();
  const words = strings.settings.badges.families;
  const cards = families.flatMap((family) => {
    const members = badges.filter((badge) => badge.family === family.id);
    const first = members[0];
    return first === undefined ? [] : [{ family, size: members.length, symbol: first.symbol }];
  });
  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      showsHorizontalScrollIndicator={false}
      testID="badge-families"
      horizontal
      contentContainerStyle={styles.row}
    >
      {cards.map(({ family, size, symbol }) => {
        const id = `badge-families-${family.id}`;
        return (
          <View
            key={family.id}
            testID={id}
            style={[
              styles.card,
              {
                backgroundColor: colors.tile,
                borderColor: colors.line,
                boxShadow: `0 ${String(badgeFamilies.edge)}px 0 ${colors.tileEdge}`,
              },
            ]}
          >
            <View style={styles.head}>
              <BadgeMark
                testID={`${id}-mark`}
                shape={family.shape}
                tone={family.tone}
                symbol={symbol}
                state={{ kind: 'earned', isNew: false }}
                size={badgeFamilies.mark}
              />
              <View style={styles.name}>
                <Text
                  accessibilityRole="header"
                  {...voice}
                  style={[typeStyle('badgeFamilyName', tokens), { color: colors.ink }]}
                >
                  {family.name}
                </Text>
                <Text
                  testID={`${id}-count`}
                  {...voice}
                  style={[typeStyle('progressCount', tokens), { color: colors.muted }]}
                >
                  {count(words.count, size)}
                </Text>
              </View>
            </View>
            <Text
              testID={`${id}-description`}
              {...voice}
              style={[typeStyle('badgeFamilyText', tokens), { color: colors.ink }]}
            >
              {family.description}
            </Text>
            <View testID={`${id}-shape`} style={[styles.shape, { borderTopColor: colors.line }]}>
              <Text
                {...voice}
                style={[typeStyle('badgeFamilyLabel', tokens), { color: colors.muted }]}
              >
                {words.shape}
              </Text>
              <Text {...voice} style={[typeStyle('progressCount', tokens), { color: colors.ink }]}>
                {words.shapes[family.shape]}
              </Text>
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: badgeFamilies.cardGap, paddingBottom: badgeFamilies.edge },
  card: {
    width: badgeFamilies.width,
    gap: badgeFamilies.gap,
    padding: badgeFamilies.padding,
    borderRadius: badgeFamilies.radius,
    borderWidth: badgeFamilies.rule,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: badgeFamilies.headGap },
  name: { flex: 1, gap: badgeFamilies.nameGap },
  shape: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: badgeFamilies.shapeGap,
    paddingTop: badgeFamilies.shapeTop,
    borderTopWidth: badgeFamilies.rule,
  },
});
