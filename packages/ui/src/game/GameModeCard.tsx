import { sentences } from '@slovo/core';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Wedge } from '../primitives/Wedge';
import { useEdition } from '../providers/EditionProvider';
import { useSchemeColors, useTokens } from '../providers/TokensProvider';
import { modeRow, pressedFade, shadowEdge, space, typeStyle, wedges } from '../tokens';

/** How far the largest text sizes of iOS may scale the row's text, so it never breaks a word. */
const TEXT_MAX_FONT_SCALE = 1.5;
/** How much a mode that can't start fades, like an answered Round's other options. */
const UNAVAILABLE_OPACITY = 0.45;

/**
 * A Game Mode's row on the mode screen: its glyph on a pressed tile, red
 * while the mode can start, its name over its line, and its Best result at
 * the end once it has one, over a hairline. A tap starts a Game. A mode that
 * can't start shows its glyph on the neutral tile, fades and takes no tap;
 * once it knows why, it says so in place of its line. VoiceOver reads the
 * row as one button.
 */
export function GameModeCard({
  glyph,
  title,
  description,
  canStart,
  refusal,
  best,
  onPress,
  testID,
}: {
  /** The few characters on the mode's tile, such as «АЯ». */
  glyph: string;
  title: string;
  description: string;
  /** Whether a Game in the mode can start now. */
  canStart: boolean;
  /** Why the mode can't start now; nothing when it can, or while that is not known yet. */
  refusal: string | undefined;
  /** The mode's Best result, such as «Найкраще: 12 з 15»; nothing before its first finished Game. */
  best: string | undefined;
  onPress: () => void;
  testID?: string;
}) {
  const tokens = useTokens();
  const { colors } = tokens;
  const keyInk = useSchemeColors('light').ink;
  const { voice } = useEdition();
  const unavailable = !canStart;
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
        styles.row,
        {
          borderBottomColor: colors.line,
          opacity: unavailable ? UNAVAILABLE_OPACITY : pressed ? pressedFade : 1,
        },
      ]}
    >
      <View
        testID={testID === undefined ? undefined : `${testID}-tile`}
        style={[
          styles.tile,
          {
            backgroundColor: canStart ? colors.accent : colors.tile,
            borderBottomColor: shadowEdge(colors, canStart),
          },
        ]}
      >
        <Text
          maxFontSizeMultiplier={TEXT_MAX_FONT_SCALE}
          style={[typeStyle('modeGlyph', tokens), { color: canStart ? keyInk : colors.ink }]}
        >
          {glyph}
        </Text>
      </View>
      <View style={styles.texts}>
        <Text
          maxFontSizeMultiplier={TEXT_MAX_FONT_SCALE}
          style={[typeStyle('modeName', tokens), { color: colors.ink }]}
        >
          {title}
        </Text>
        <Text
          maxFontSizeMultiplier={TEXT_MAX_FONT_SCALE}
          numberOfLines={refusal === undefined ? 1 : undefined}
          style={[
            typeStyle('modeLine', tokens),
            { color: refusal === undefined ? colors.muted : colors.ink },
          ]}
        >
          {refusal ?? description}
        </Text>
      </View>
      {best === undefined ? null : (
        <Text
          maxFontSizeMultiplier={TEXT_MAX_FONT_SCALE}
          style={[typeStyle('modeBest', tokens), styles.best, { color: colors.muted }]}
        >
          {best}
        </Text>
      )}
    </Pressable>
  );
}

/** The Games screen's big title. */
export function GamesTitle({ children }: { children: string }) {
  const tokens = useTokens();
  return (
    <Text
      accessibilityRole="header"
      maxFontSizeMultiplier={TEXT_MAX_FONT_SCALE}
      style={[typeStyle('gamesTitle', tokens), { color: tokens.colors.ink }]}
    >
      {children}
    </Text>
  );
}

/** The title of a group of Game Modes on the mode screen, after a red mark. */
export function GameModeGroupTitle({ children }: { children: string }) {
  const tokens = useTokens();
  return (
    <View style={styles.groupTitle}>
      <Wedge points={wedges.band} color={tokens.colors.accent} {...modeRow.groupMark} />
      <Text
        accessibilityRole="header"
        maxFontSizeMultiplier={TEXT_MAX_FONT_SCALE}
        style={[typeStyle('groupTitle', tokens), { color: tokens.colors.ink }]}
      >
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  groupTitle: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: modeRow.gap,
    paddingVertical: modeRow.paddingVertical,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tile: {
    width: modeRow.tile,
    height: modeRow.tile,
    borderRadius: modeRow.tileRadius,
    borderBottomWidth: modeRow.tileDepth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  texts: { flex: 1, minWidth: 0, gap: space[1] },
  best: { flexShrink: 1, maxWidth: '35%', textAlign: 'right' },
});
