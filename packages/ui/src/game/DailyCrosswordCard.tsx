import { StyleSheet, Text, View } from 'react-native';

import { CardCorners } from '../decor/DecorSlots';
import { useEdition } from '../providers/EditionProvider';
import { useTokens } from '../providers/TokensProvider';
import { modeCardPaddingHorizontal, space, typeSize } from '../tokens';

/** How far the largest text sizes of iOS may scale the card's name, so it never breaks a word. */
const TITLE_MAX_FONT_SCALE = 1.3;
/** How far the largest text sizes of iOS may scale the card's state, so it never breaks a word. */
const TEXT_MAX_FONT_SCALE = 1.5;

/**
 * The Daily Crossword's card on top of the mode screen: its name with today's
 * date, then «Почати» or «Продовжити» in the accent colour, or, once today's
 * is solved, its mark in the colour of a right answer. A surface card with
 * the Edition's corner, as a mode card; VoiceOver reads it as one element.
 */
export function DailyCrosswordCard({
  title,
  state,
  solved,
  testID,
}: {
  /** Its name with today's date, such as «Кросворд дня · 26 жовтня». */
  title: string;
  /** «Почати», «Продовжити» or the solved mark, such as «✓ Розв’язано». */
  state: string;
  /** Whether today's is solved. */
  solved: boolean;
  testID?: string;
}) {
  const { colors, radii, fontFamilies } = useTokens();
  const { voice } = useEdition();
  return (
    <View
      testID={testID}
      accessible
      accessibilityLabel={`${title}. ${state}`}
      {...voice}
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: radii.card },
      ]}
    >
      <CardCorners corners={['topLeft']} />
      <Text
        maxFontSizeMultiplier={TITLE_MAX_FONT_SCALE}
        style={[styles.title, { color: colors.ink, fontFamily: fontFamilies.word }]}
      >
        {title}
      </Text>
      <Text
        maxFontSizeMultiplier={TEXT_MAX_FONT_SCALE}
        style={[
          styles.state,
          { color: solved ? colors.correct : colors.accent, fontFamily: fontFamilies.ui },
        ]}
      >
        {state}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingVertical: space[6],
    paddingHorizontal: modeCardPaddingHorizontal,
    gap: space[3],
    borderWidth: 1,
  },
  title: {
    fontSize: typeSize.emptyStateTitle,
    lineHeight: typeSize.emptyStateTitle * 1.15,
    fontWeight: '500',
  },
  state: { fontSize: typeSize.body, lineHeight: typeSize.body * 1.4, fontWeight: '600' },
});
