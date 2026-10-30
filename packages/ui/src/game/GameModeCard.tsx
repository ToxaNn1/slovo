import type { EntryKind } from '@slovo/contracts';
import { sentences } from '@slovo/core';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { CardCorners } from '../decor/DecorSlots';
import { useEdition } from '../providers/EditionProvider';
import { modeCardPaddingHorizontal, overlineType, space, typeSize, withAlpha } from '../tokens';
import { InvertedTokens, useTokens } from '../providers/TokensProvider';

/** The arrow's size, from the design. */
const ARROW_SIZE = 22;
/** How far the largest text sizes of iOS may scale the mode's name, so it never breaks a word. */
const TITLE_MAX_FONT_SCALE = 1.3;
/** How far the largest text sizes of iOS may scale the card's smaller text, so it never breaks a word. */
const TEXT_MAX_FONT_SCALE = 1.5;
/** How much a mode that can't start fades, like an answered Round's other options. */
const UNAVAILABLE_OPACITY = 0.45;
/** How much a pressed card on the ink fill fades. */
const PRESSED_INVERTED_OPACITY = 0.85;

/**
 * A Game Mode's card on the mode screen (`game-mode-select-dark`): the
 * overline, the mode's name, a line on how it plays and a sample with an
 * arrow, in a surface card with the Edition's corner. The card of a mode
 * that asks about Corrections is drawn on the ink fill in the other colour
 * scheme, without the corner, and its sample's non-standard form is struck
 * through. Once the mode has a Best result, the card ends with it. A tap
 * starts a Game. A mode that can't start fades and takes no tap; once it
 * knows why, it says so in place of the sample. VoiceOver reads the card as
 * one button.
 */
export function GameModeCard({
  entryKind,
  overline,
  title,
  description,
  sample,
  canStart,
  refusal,
  best,
  onPress,
  testID,
}: {
  /** The kind of Entry the mode asks about. */
  entryKind: EntryKind;
  overline: string;
  title: string;
  description: string;
  /** A prompt and the answer it asks for, such as a Definition and a Lemma, or a non-standard form and its standard one. */
  sample: { readonly prompt: string; readonly answer: string };
  /** Whether a Game in the mode can start now. */
  canStart: boolean;
  /** Why the mode can't start now; nothing when it can, or while that is not known yet. */
  refusal: string | undefined;
  /** The mode's Best result, such as «Найкраще: 12 з 15»; nothing before its first finished Game. */
  best: string | undefined;
  onPress: () => void;
  testID?: string;
}) {
  const { colors, radii } = useTokens();
  const { voice } = useEdition();
  const unavailable = !canStart;
  const inverted = entryKind === 'correction';
  const content = (
    <CardContent
      inverted={inverted}
      overline={overline}
      title={title}
      description={description}
      sample={sample}
      refusal={refusal}
      best={best}
    />
  );
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={sentences([title, description, refusal, best])}
      accessibilityState={{ disabled: unavailable }}
      {...voice}
      disabled={unavailable}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        inverted
          ? {
              backgroundColor: colors.ink,
              borderColor: colors.ink,
              opacity: unavailable ? UNAVAILABLE_OPACITY : pressed ? PRESSED_INVERTED_OPACITY : 1,
            }
          : {
              backgroundColor: pressed ? colors.surfaceSunken : colors.surface,
              borderColor: colors.line,
              opacity: unavailable ? UNAVAILABLE_OPACITY : 1,
            },
        { borderRadius: radii.card },
      ]}
    >
      {inverted ? <InvertedTokens>{content}</InvertedTokens> : content}
    </Pressable>
  );
}

/** What a mode card holds, in the colours in effect. */
function CardContent({
  inverted,
  overline,
  title,
  description,
  sample,
  refusal,
  best,
}: {
  /** Whether it is a Correction mode's card, on the ink fill, its sample's prompt struck through. */
  inverted: boolean;
  overline: string;
  title: string;
  description: string;
  sample: { readonly prompt: string; readonly answer: string };
  refusal: string | undefined;
  best: string | undefined;
}) {
  const { colors, fontFamilies } = useTokens();
  return (
    <>
      {inverted ? null : <CardCorners corners={['topLeft']} />}
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
      {refusal !== undefined ? (
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
            style={[
              styles.sample,
              inverted ? styles.correctionSample : styles.italic,
              { color: inverted ? colors.ink : colors.inkSecondary, fontFamily: fontFamilies.word },
            ]}
          >
            {inverted ? (
              <Text
                style={[styles.struck, { textDecorationColor: withAlpha(colors.accent, 0.55) }]}
              >
                {sample.prompt}
              </Text>
            ) : (
              sample.prompt
            )}
            {` → ${sample.answer}`}
          </Text>
          <Svg width={ARROW_SIZE} height={ARROW_SIZE} viewBox="0 0 24 24">
            <Path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke={colors.accent} strokeWidth={2} />
          </Svg>
        </View>
      )}
      {best === undefined ? null : (
        <Text
          maxFontSizeMultiplier={TEXT_MAX_FONT_SCALE}
          style={[styles.best, { color: colors.muted, fontFamily: fontFamilies.ui }]}
        >
          {best}
        </Text>
      )}
    </>
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
  description: { fontSize: typeSize.modeDescription, lineHeight: typeSize.modeDescription * 1.5 },
  sampleRow: {
    marginTop: space[1],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[3],
  },
  sample: { flex: 1, fontSize: typeSize.explanation },
  italic: { fontStyle: 'italic' },
  correctionSample: { fontSize: typeSize.listItem },
  struck: { textDecorationLine: 'line-through' },
  best: { fontSize: typeSize.body, lineHeight: typeSize.body * 1.4 },
});
