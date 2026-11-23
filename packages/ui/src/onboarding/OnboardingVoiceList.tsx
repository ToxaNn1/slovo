'use no memo';

import type { NarratorVoice } from '@slovo/contracts';
import { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaFrame } from 'react-native-safe-area-context';

import { Icon } from '../primitives/Icon';
import { useEdition } from '../providers/EditionProvider';
import { useSchemeColors, useTokens } from '../providers/TokensProvider';
import { useReduceMotion } from '../providers/useReduceMotion';
import { fontScaleCap, onboardingVoiceLayout as layout, typeStyle, withAlpha } from '../tokens';

/**
 * The card of «ГОЛОС», the onboarding's Narrator Voice step (design
 * `XObVoice`): a row per voice with its name, what it sounds like and a play
 * mark, the chosen row in red. While the chosen voice reads, its row shows the
 * sample Word's syllables lighting up in turn and its mark turns into swinging
 * bars; under Reduce Motion they stay still. While the sample cannot sound
 * (`silent`: offline, or no Recording) a row is still chosen and every mark is
 * grey. A tap asks `onChoose` with the voice's id. The card scrolls inside
 * itself when the screen is too short for every row.
 */
export function OnboardingVoiceList({
  voices,
  chosen,
  playing,
  silent,
  syllables,
  rest,
  onChoose,
  testID,
}: {
  voices: readonly NarratorVoice[];
  /** The id of the chosen voice. */
  chosen: string;
  /** Whether the chosen voice reads the sample Word now. */
  playing: boolean;
  /** Whether the sample cannot sound now. */
  silent: boolean;
  /** The sample Word's syllables as they are shown, the stress marked. */
  syllables: readonly string[];
  /** What follows the syllables on a reading row, such as « · ім., ж. р.». */
  rest: string;
  onChoose: (id: string) => void;
  testID?: string;
}) {
  const tokens = useTokens();
  const { colors } = tokens;
  // The design's black on red is the light Theme's ink in both Themes.
  const light = useSchemeColors('light');
  const { voice } = useEdition();
  const reduceMotion = useReduceMotion();
  const moving = playing && !reduceMotion;
  const compact = useSafeAreaFrame().height < layout.compactBelow;
  const rowHeight = compact ? layout.row.compactHeight : layout.row.height;
  const markSize = compact ? layout.mark.compactSize : layout.mark.size;
  return (
    <View style={[styles.edge, { backgroundColor: colors.tileEdge }]}>
      <ScrollView
        testID={testID}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        style={[styles.card, { backgroundColor: colors.tile, borderColor: colors.line }]}
      >
        {voices.map((option, index) => {
          const on = option.id === chosen;
          const reading = on && playing;
          const ink = on ? light.ink : colors.ink;
          const markFill = silent
            ? on
              ? withAlpha(light.ink, layout.silent.fill)
              : colors.silhouette
            : on
              ? light.ink
              : colors.ink;
          const markGlyph = silent
            ? on
              ? withAlpha(light.ink, layout.silent.glyph)
              : colors.muted
            : on
              ? colors.accent
              : colors.background;
          return (
            <Pressable
              key={option.id}
              testID={testID === undefined ? undefined : `${testID}-${option.id}`}
              accessibilityRole="button"
              accessibilityLabel={option.name}
              accessibilityHint={option.description}
              accessibilityLanguage={voice.accessibilityLanguage}
              accessibilityState={{ selected: on }}
              onPress={() => {
                onChoose(option.id);
              }}
              style={({ pressed }) => [
                styles.row,
                { minHeight: rowHeight, backgroundColor: on ? colors.accent : undefined },
                index > 0 && { borderTopColor: colors.line, ...styles.rowLine },
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.lines}>
                <Text
                  {...voice}
                  maxFontSizeMultiplier={fontScaleCap.text}
                  style={[typeStyle('voiceName', tokens), { color: ink }]}
                >
                  {option.name}
                </Text>
                {reading ? (
                  <Text
                    {...voice}
                    maxFontSizeMultiplier={fontScaleCap.text}
                    style={[typeStyle('voiceDescription', tokens), { color: ink }]}
                  >
                    {syllables.map((syllable, at) => (
                      // The syllables of the one sample Word never reorder.
                      <Syllable
                        key={at}
                        text={at === 0 ? syllable : `-${syllable}`}
                        index={at}
                        moving={moving}
                        color={ink}
                        lit={light.background}
                      />
                    ))}
                    {rest}
                  </Text>
                ) : (
                  <Text
                    {...voice}
                    maxFontSizeMultiplier={fontScaleCap.text}
                    style={[
                      typeStyle('voiceDescription', tokens),
                      styles.description,
                      { color: ink },
                    ]}
                  >
                    {option.description}
                  </Text>
                )}
              </View>
              <View
                testID={
                  testID === undefined
                    ? undefined
                    : `${testID}-${option.id}-${reading ? 'bars' : 'play'}`
                }
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                style={[
                  styles.mark,
                  { width: markSize, height: markSize, backgroundColor: markFill },
                ]}
              >
                {reading ? (
                  Array.from({ length: layout.bars.count }, (_, at) => (
                    // The bars are a fixed drawing; their order never changes.
                    <Bar key={at} index={at} moving={moving} color={markGlyph} />
                  ))
                ) : (
                  <Icon name="play" color={markGlyph} size={layout.mark.glyph} />
                )}
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

/** One syllable of the sample Word: it lights up in its turn, again and again, while the voice reads. */
function Syllable({
  text,
  index,
  moving,
  color,
  lit,
}: {
  text: string;
  index: number;
  moving: boolean;
  color: string;
  lit: string;
}) {
  const glow = useSharedValue(0);
  useEffect(() => {
    cancelAnimation(glow);
    glow.value = 0;
    if (!moving) return;
    const { cycle, step, rise, lit: held } = layout.syllable;
    glow.value = withDelay(
      index * step,
      withRepeat(
        withSequence(
          withTiming(0, { duration: rise }),
          withTiming(1, { duration: 0 }),
          withTiming(1, { duration: held }),
          withTiming(0, { duration: 0 }),
          withTiming(0, { duration: cycle - rise - held }),
        ),
        -1,
      ),
    );
  }, [moving, index, glow]);
  const motion = useAnimatedStyle(() => ({ color: glow.value === 1 ? lit : color }));
  return <Animated.Text style={motion}>{text}</Animated.Text>;
}

/** One bar of a reading row's mark: it swings while the voice reads and stands still otherwise. */
function Bar({ index, moving, color }: { index: number; moving: boolean; color: string }) {
  const { rest, half, stagger } = layout.bars;
  const scale = useSharedValue(1);
  useEffect(() => {
    cancelAnimation(scale);
    scale.value = 1;
    if (!moving) return;
    scale.value = rest;
    scale.value = withDelay(
      index * stagger,
      withRepeat(withTiming(1, { duration: half }), -1, true),
    );
  }, [moving, index, scale, rest, half, stagger]);
  const motion = useAnimatedStyle(() => ({ transform: [{ scaleY: scale.value }] }));
  return <Animated.View style={[styles.bar, { backgroundColor: color }, motion]} />;
}

const styles = StyleSheet.create({
  // The card's edge under it, as the board's offset shadow.
  edge: { borderRadius: layout.card.radius, paddingBottom: layout.card.edge, flexShrink: 1 },
  card: {
    flexGrow: 0,
    borderRadius: layout.card.radius,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: layout.row.gap,
    paddingLeft: layout.row.paddingLeft,
    paddingRight: layout.row.paddingRight,
    paddingVertical: layout.row.paddingVertical,
  },
  rowLine: { borderTopWidth: StyleSheet.hairlineWidth },
  pressed: { opacity: layout.pressedOpacity },
  lines: { flex: 1, minWidth: 0, gap: layout.row.lineGap },
  description: { opacity: layout.descriptionOpacity },
  mark: {
    borderRadius: layout.mark.radius,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: layout.bars.gap,
  },
  bar: { width: layout.bars.width, height: layout.bars.height },
});
