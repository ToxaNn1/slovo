import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { CardCorners } from './DecorSlots';
import { useEdition } from './EditionProvider';
import { overlineType, space } from './tokens';
import { useTokens } from './TokensProvider';

/** The arrow's size, from the design. */
const ARROW_SIZE = 22;
/** How far the largest text sizes of iOS may scale the mode's name, so it never breaks a word. */
const TITLE_MAX_FONT_SCALE = 1.3;
/** How far the largest text sizes of iOS may scale the card's smaller text, so it never breaks a word. */
const TEXT_MAX_FONT_SCALE = 1.5;
/** How much a mode that can't start fades, like an answered Round's other options. */
const UNAVAILABLE_OPACITY = 0.45;

/**
 * A Game Mode's card on the mode screen (`game-mode-select-dark`): the
 * overline, the mode's name, a line on how it plays and a sample with an
 * arrow, in a surface card with the Edition's corner. A tap starts a Game.
 * A mode that can't start fades, says why in place of the sample and takes
 * no tap. VoiceOver reads the card as one button.
 */
export function GameModeCard({
  overline,
  title,
  description,
  sample,
  refusal,
  onPress,
  testID,
}: {
  overline: string;
  title: string;
  description: string;
  /** A prompt and the answer it asks for, such as a Definition and a Lemma. */
  sample: { readonly prompt: string; readonly answer: string };
  /** Why the mode can't start now; nothing when it can. */
  refusal: string | undefined;
  onPress: () => void;
  testID?: string;
}) {
  const { colors, fontFamilies, radii } = useTokens();
  const { voice } = useEdition();
  const unavailable = refusal !== undefined;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={[title, description, refusal].filter(Boolean).join('. ')}
      accessibilityState={{ disabled: unavailable }}
      {...voice}
      disabled={unavailable}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: pressed ? colors.surfaceSunken : colors.surface,
          borderColor: colors.line,
          borderRadius: radii.card,
          opacity: unavailable ? UNAVAILABLE_OPACITY : 1,
        },
      ]}
    >
      <CardCorners corners={['topLeft']} />
      <Text
        maxFontSizeMultiplier={TEXT_MAX_FONT_SCALE}
        style={[overlineType, { color: colors.accent, fontFamily: fontFamilies.ui }]}
      >
        {overline}
      </Text>
      <Text
        maxFontSizeMultiplier={TITLE_MAX_FONT_SCALE}
        style={[styles.title, { color: colors.ink, fontFamily: fontFamilies.word }]}
      >
        {title}
      </Text>
      <Text
        maxFontSizeMultiplier={TEXT_MAX_FONT_SCALE}
        style={[styles.description, { color: colors.muted, fontFamily: fontFamilies.ui }]}
      >
        {description}
      </Text>
      {unavailable ? (
        <Text
          maxFontSizeMultiplier={TEXT_MAX_FONT_SCALE}
          style={[styles.description, { color: colors.ink, fontFamily: fontFamilies.ui }]}
        >
          {refusal}
        </Text>
      ) : (
        <View style={styles.sampleRow}>
          <Text
            maxFontSizeMultiplier={TEXT_MAX_FONT_SCALE}
            style={[styles.sample, { color: colors.inkSecondary, fontFamily: fontFamilies.word }]}
          >
            {`${sample.prompt} → ${sample.answer}`}
          </Text>
          <Svg width={ARROW_SIZE} height={ARROW_SIZE} viewBox="0 0 24 24">
            <Path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke={colors.accent} strokeWidth={2} />
          </Svg>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingVertical: space[6],
    paddingHorizontal: 22,
    gap: space[3],
    borderWidth: 1,
  },
  title: { fontSize: 28, lineHeight: 28 * 1.15, fontWeight: '500' },
  description: { fontSize: 14.5, lineHeight: 14.5 * 1.5 },
  sampleRow: {
    marginTop: space[1],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[3],
  },
  sample: { flex: 1, fontSize: 16, fontStyle: 'italic' },
});
