'use no memo';
// Reanimated code: the React Compiler skips this module (ADR 0059).

import { sentences } from '@slovo/core';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { useCascade, type Cascade } from '../primitives/useCascade';
import { Wedge } from '../primitives/Wedge';
import { useEdition } from '../providers/EditionProvider';
import { useSchemeColors, useTokens } from '../providers/TokensProvider';
import {
  fontScaleCap,
  modeRow,
  pressedFade,
  shadowEdge,
  space,
  typeStyle,
  wedges,
} from '../tokens';

/** How the rows of board 06 «Хаб ігор» rise in, one after another. */
const HUB_CASCADE: Cascade = { variant: 'rise', duration: 300, stagger: 50 };

/** How much a mode that can't start fades, like an answered Round's other options. */
const UNAVAILABLE_OPACITY = 0.45;

/**
 * A Game Mode's row on the mode screen: its glyph on a pressed tile, red
 * while the mode can start, then its name, its whole line, wrapped, and its
 * mark under them, the Best result («★ 12», «Рекорд: 12 з 15») or a dash or
 * «Ще жодної гри» before the first finished Game, over a hairline. The mark
 * shares the text's column, so the line keeps the row's full width. A tap starts a Game. A mode that
 * can't start shows its glyph on the neutral tile, fades and takes no tap;
 * once it knows why, it says so in place of its line. VoiceOver reads the
 * row as one button, with the Best result in words and no dash. Given its
 * place on the screen, the row rises in after the rows before it (board 06);
 * under Reduce Motion it fades in instead.
 */
export function GameModeCard({
  glyph,
  title,
  line,
  canStart,
  refusal,
  best,
  bestLabel,
  onPress,
  testID,
  cascadeIndex,
}: {
  /** The few characters on the mode's tile, such as «АЯ». */
  glyph: string;
  title: string;
  /** The mode's one line under its name, such as «Обери слово за визначенням». */
  line: string;
  /** Whether a Game in the mode can start now. */
  canStart: boolean;
  /** Why the mode can't start now; nothing when it can, or while that is not known yet. */
  refusal: string | undefined;
  /** The mark at the row's end: the Best result, such as «★ 12», or «—» before the first finished Game. */
  best: string;
  /** What VoiceOver reads for the Best result, such as «Найкраще: 12 з 15»; nothing before the first finished Game. */
  bestLabel: string | undefined;
  onPress: () => void;
  testID?: string;
  /** The row's place among the rows that cascade in; it shows at once without one. */
  cascadeIndex?: number;
}) {
  const tokens = useTokens();
  const { colors } = tokens;
  const keyInk = useSchemeColors('light').ink;
  const { voice } = useEdition();
  const unavailable = !canStart;
  const row = (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={sentences([title, refusal ?? line, bestLabel])}
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
          maxFontSizeMultiplier={fontScaleCap.text}
          style={[typeStyle('modeGlyph', tokens), { color: canStart ? keyInk : colors.ink }]}
        >
          {glyph}
        </Text>
      </View>
      <View testID={testID === undefined ? undefined : `${testID}-texts`} style={styles.texts}>
        <Text
          maxFontSizeMultiplier={fontScaleCap.text}
          style={[typeStyle('modeName', tokens), { color: colors.ink }]}
        >
          {title}
        </Text>
        <Text
          maxFontSizeMultiplier={fontScaleCap.text}
          style={[
            typeStyle('modeLine', tokens),
            { color: refusal === undefined ? colors.muted : colors.ink },
          ]}
        >
          {refusal ?? line}
        </Text>
        <Text
          maxFontSizeMultiplier={fontScaleCap.text}
          style={[typeStyle('modeBest', tokens), { color: colors.muted }]}
        >
          {best}
        </Text>
      </View>
    </Pressable>
  );
  return cascadeIndex === undefined ? row : <CascadeIn index={cascadeIndex}>{row}</CascadeIn>;
}

/** A hub row rising in at its place in the cascade. */
function CascadeIn({ index, children }: { index: number; children: ReactNode }) {
  const entered = useCascade(index, HUB_CASCADE);
  return <Animated.View style={entered}>{children}</Animated.View>;
}

/** The Games screen's big title. */
export function GamesTitle({ children }: { children: string }) {
  const tokens = useTokens();
  return (
    <Text
      accessibilityRole="header"
      maxFontSizeMultiplier={fontScaleCap.text}
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
        maxFontSizeMultiplier={fontScaleCap.text}
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
});
