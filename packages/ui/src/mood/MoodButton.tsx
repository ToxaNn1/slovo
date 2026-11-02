import { Pressable, StyleSheet, Text } from 'react-native';

import { useEdition } from '../providers/EditionProvider';
import { useTokens } from '../providers/TokensProvider';
import { minTouchTarget, pressedFade, typeSize } from '../tokens';

/** The button's size, the Stats pill's height beside it. */
const BUTTON_SIZE = 40;

/**
 * The 🎲 of the «Головна» header, which opens the moods. A tile the height
 * of the Stats pill; VoiceOver reads «Слово під настрій».
 */
export function MoodButton({ onPress }: { onPress: () => void }) {
  const { colors, radii } = useTokens();
  const { strings, voice } = useEdition();
  return (
    <Pressable
      testID="mood-button"
      accessibilityRole="button"
      accessibilityLabel={strings.mood.title}
      {...voice}
      onPress={onPress}
      // The 40 pt tile takes taps a little beyond its edge, to the 44 pt touch target.
      hitSlop={(minTouchTarget - BUTTON_SIZE) / 2}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: colors.tile, borderColor: colors.line, borderRadius: radii.tile },
        { opacity: pressed ? pressedFade : 1 },
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
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  die: { fontSize: typeSize.blockHeading },
});
