import { useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';

import { HalftoneGround } from '../primitives/HalftoneGround';
import { PressedTile } from '../primitives/PressedTile';
import { useSchemeColors, useTokens } from '../providers/TokensProvider';
import { dailyCrosswordCard, typeStyle } from '../tokens';

/** How far the largest text sizes of iOS may scale the card's text, so it never breaks a word. */
const TEXT_MAX_FONT_SCALE = 1.3;

/**
 * The Daily Crossword's card on top of the mode screen, as the design's
 * red pressed card under the halftone raster: its name with today's date
 * over «Почати», «Продовжити» or the solved mark, in the key ink. A tap
 * anywhere on it opens the crossword's screen, and VoiceOver reads it as
 * one button.
 */
export function DailyCrosswordCard({
  title,
  state,
  onPress,
  testID,
}: {
  /** Its name with today's date, such as «Кросворд дня · 26 жовтня». */
  title: string;
  /** «Почати», «Продовжити» or the solved mark, such as «✓ Розв’язано». */
  state: string;
  /** Opens the crossword's screen. */
  onPress: () => void;
  testID?: string;
}) {
  const tokens = useTokens();
  const keyInk = useSchemeColors('light').ink;
  const [size, setSize] = useState<{ width: number; height: number }>();
  const measure = ({ nativeEvent }: LayoutChangeEvent) => {
    const { width, height } = nativeEvent.layout;
    setSize({ width, height });
  };
  return (
    <PressedTile
      tone="accent"
      radius={tokens.radii.card}
      accessibilityLabel={`${title}. ${state}`}
      onPress={onPress}
      faceStyle={styles.face}
      testID={testID}
    >
      <View style={StyleSheet.absoluteFill} onLayout={measure}>
        {size === undefined ? null : (
          <HalftoneGround id="daily-crossword" width={size.width} height={size.height} />
        )}
      </View>
      <View style={styles.body}>
        <Text
          maxFontSizeMultiplier={TEXT_MAX_FONT_SCALE}
          style={[typeStyle('crosswordTitle', tokens), { color: keyInk }]}
        >
          {title}
        </Text>
        <Text
          maxFontSizeMultiplier={TEXT_MAX_FONT_SCALE}
          style={[typeStyle('crosswordState', tokens), { color: keyInk }]}
        >
          {state}
        </Text>
      </View>
    </PressedTile>
  );
}

const styles = StyleSheet.create({
  face: { overflow: 'hidden' },
  body: { padding: dailyCrosswordCard.padding, gap: dailyCrosswordCard.gap },
});
