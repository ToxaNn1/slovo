import { Pressable, StyleSheet, Text } from 'react-native';

import { useEdition } from '../providers/EditionProvider';
import { useTokens } from '../providers/TokensProvider';
import { minTouchTarget, typeSize, withAlpha } from '../tokens';

/** The button's size, the Stats pill's height beside it. */
const BUTTON_SIZE = 40;

/**
 * The 🎲 of the «Головна» header, which opens the moods. A round button the
 * size of the Stats pill; VoiceOver reads «Слово під настрій».
 */
export function MoodButton({ onPress }: { onPress: () => void }) {
  const { colors } = useTokens();
  const { strings, voice } = useEdition();
  return (
    <Pressable
      testID="mood-button"
      accessibilityRole="button"
      accessibilityLabel={strings.mood.title}
      {...voice}
      onPress={onPress}
      // The 40 pt circle takes taps a little beyond its edge, to the 44 pt touch target.
      hitSlop={(minTouchTarget - BUTTON_SIZE) / 2}
      style={({ pressed }) => [
        styles.button,
        // The border of the Stats pill, at 35% of the accent.
        { backgroundColor: colors.surface, borderColor: withAlpha(colors.accent, 0.35) },
        { opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <Text
        // The die is a picture; the button's label says what it does.
        accessibilityElementsHidden
        importantForAccessibility="no"
        allowFontScaling={false}
        style={styles.die}
      >
        🎲
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  die: { fontSize: typeSize.blockHeading },
});
