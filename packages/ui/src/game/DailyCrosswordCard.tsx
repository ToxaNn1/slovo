import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CardCorners } from '../decor/DecorSlots';
import { Button } from '../primitives/Button';
import { useEdition } from '../providers/EditionProvider';
import { useTokens } from '../providers/TokensProvider';
import { dailyCrosswordCard } from '../tokens';

/** How far the largest text sizes of iOS may scale the card's name, so it never breaks a word. */
const TITLE_MAX_FONT_SCALE = 1.3;

/** How far today's Daily Crossword has come: no letter in, some letters in, or solved. */
export type DailyCrosswordProgress = 'untouched' | 'started' | 'solved';

/**
 * The Daily Crossword's card on top of the mode screen: its name with
 * today's date beside a small «Почати» in red or «Продовжити» in ink, as the
 * design's pressed buttons; once today's is solved, an ink card with its
 * mark in red. A tap anywhere on it opens the crossword's screen, and
 * VoiceOver reads it as one button.
 */
export function DailyCrosswordCard({
  title,
  state,
  progress,
  onPress,
  testID,
}: {
  /** Its name with today's date, such as «Кросворд дня · 26 жовтня». */
  title: string;
  /** «Почати», «Продовжити» or the solved mark, such as «✓ Розв’язано». */
  state: string;
  /** How far today's has come. */
  progress: DailyCrosswordProgress;
  /** Opens the crossword's screen. */
  onPress: () => void;
  testID?: string;
}) {
  const { colors, radii, fontFamilies } = useTokens();
  const { voice } = useEdition();
  const solved = progress === 'solved';
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${state}`}
      {...voice}
      onPress={onPress}
      style={[
        styles.card,
        solved
          ? { backgroundColor: colors.ink, borderColor: colors.ink }
          : { backgroundColor: colors.surface, borderColor: colors.line },
        { borderRadius: radii.card },
      ]}
    >
      {!solved && <CardCorners corners={['topLeft']} />}
      <View style={solved ? styles.solvedBody : styles.row}>
        <Text
          maxFontSizeMultiplier={TITLE_MAX_FONT_SCALE}
          style={[
            styles.title,
            !solved && styles.titleBeside,
            { color: solved ? colors.background : colors.ink, fontFamily: fontFamilies.word },
          ]}
        >
          {title}
        </Text>
        {solved ? (
          <Text
            maxFontSizeMultiplier={TITLE_MAX_FONT_SCALE}
            style={[styles.mark, { color: colors.accent, fontFamily: fontFamilies.word }]}
          >
            {state}
          </Text>
        ) : (
          <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Button
              size="small"
              variant={progress === 'started' ? 'onAccent' : 'primary'}
              label={state}
              onPress={onPress}
            />
          </View>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { padding: dailyCrosswordCard.padding, borderWidth: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: dailyCrosswordCard.gap },
  solvedBody: { gap: dailyCrosswordCard.gap },
  titleBeside: { flex: 1 },
  title: {
    fontSize: dailyCrosswordCard.titleSize,
    lineHeight: dailyCrosswordCard.titleSize * 1.15,
    fontWeight: '800',
  },
  mark: {
    fontSize: dailyCrosswordCard.solvedSize,
    lineHeight: dailyCrosswordCard.solvedSize * 1.15,
    fontWeight: '900',
  },
});
