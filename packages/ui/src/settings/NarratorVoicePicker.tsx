'use no memo';

import { fill, type NarratorVoice, type NarratorVoiceSample } from '@slovo/contracts';
import { useEffect, useState } from 'react';
import { type LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { HalftoneGround } from '../primitives/HalftoneGround';
import { Icon } from '../primitives/Icon';
import { PressedTile } from '../primitives/PressedTile';
import { useEdition } from '../providers/EditionProvider';
import { useSchemeColors, useTokens } from '../providers/TokensProvider';
import { useReduceMotion } from '../providers/useReduceMotion';
import { narratorVoiceDrawing as drawing, space, typeStyle } from '../tokens';

/**
 * The Narrator Voice screen's body (design `XVoice`): the red scene where the
 * chosen voice reads the sample Word, its syllables lifting one by one and
 * the bars swinging while it reads, then the voices to choose from, two to a
 * row. Under Reduce Motion the syllables and bars stay still. A tap on a
 * voice asks `onChoose` with its id; the play button asks `onToggle`, and
 * while `playing` it shows the pause instead.
 */
export function NarratorVoicePicker({
  voices,
  chosen,
  sample,
  playing,
  onChoose,
  onToggle,
  testID,
}: {
  voices: readonly NarratorVoice[];
  /** The id of the chosen voice; the first voice stands for an unknown one. */
  chosen: string;
  sample: NarratorVoiceSample;
  /** Whether the voice reads the sample now. */
  playing: boolean;
  onChoose: (id: string) => void;
  onToggle: () => void;
  testID?: string | undefined;
}) {
  const tokens = useTokens();
  const { colors } = tokens;
  const light = useSchemeColors('light');
  const { strings, voice } = useEdition();
  const reduceMotion = useReduceMotion();
  const texts = strings.settings.narratorVoice;
  const reading = voices.find(({ id }) => id === chosen) ?? voices[0];
  const moving = playing && !reduceMotion;
  const rows = pairs(voices);
  return (
    <View testID={testID}>
      <View style={[styles.scene, { backgroundColor: colors.accent }]}>
        <Halftone />
        <Text {...voice} style={[typeStyle('voiceLabel', tokens), { color: light.ink }]}>
          {fill(texts.reading, {
            name: (reading?.name ?? '').toLocaleUpperCase(voice.accessibilityLanguage),
          })}
        </Text>
        <View
          style={styles.syllables}
          accessible
          accessibilityLabel={sample.syllables.join('')}
          accessibilityLanguage={voice.accessibilityLanguage}
        >
          {sample.syllables.map((syllable, index) => (
            <Syllable
              // The syllables of the one sample Word never reorder.
              key={index}
              text={syllable}
              index={index}
              moving={moving}
              color={index === sample.stressed ? colors.onAccent : light.ink}
              lit={colors.onAccent}
            />
          ))}
        </View>
        <Text {...voice} style={[typeStyle('voiceCaption', tokens), { color: light.ink }]}>
          {sample.caption}
        </Text>
        <View style={styles.player}>
          <PressedTile
            tone="ink"
            radius={drawing.playRadius}
            onPress={onToggle}
            accessibilityLabel={playing ? texts.pause : texts.play}
            accessibilityLanguage={voice.accessibilityLanguage}
            faceStyle={styles.play}
            testID={testID === undefined ? undefined : `${testID}-play`}
          >
            <Icon
              name={playing ? 'pause' : 'play'}
              color={colors.onAccent}
              size={drawing.playIcon}
            />
          </PressedTile>
          <View
            style={styles.bars}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            {Array.from({ length: drawing.bars }, (_, index) => (
              // The bars are a fixed drawing; their order never changes.
              <Bar key={index} index={index} moving={moving} color={light.ink} />
            ))}
          </View>
        </View>
      </View>
      <Text
        {...voice}
        accessibilityRole="header"
        style={[typeStyle('voiceLabel', tokens), styles.choose, { color: colors.muted }]}
      >
        {texts.choose}
      </Text>
      <View style={styles.tiles}>
        {rows.map((row) => (
          <View key={row.map(({ id }) => id).join(' ')} style={styles.row}>
            {row.map((option) => {
              const on = option.id === reading?.id;
              const ink = on ? colors.background : colors.ink;
              return (
                <View key={option.id} style={styles.cell}>
                  <PressedTile
                    tone={on ? 'inverse' : 'tile'}
                    radius={drawing.tileRadius}
                    onPress={() => {
                      onChoose(option.id);
                    }}
                    accessibilityLabel={option.name}
                    accessibilityLanguage={voice.accessibilityLanguage}
                    accessibilityHint={option.description}
                    accessibilityState={{ selected: on }}
                    faceStyle={[
                      styles.tile,
                      !on && { borderColor: colors.line, ...styles.tileBorder },
                    ]}
                    testID={testID === undefined ? undefined : `${testID}-voice-${option.id}`}
                  >
                    <Text {...voice} style={[typeStyle('voiceName', tokens), { color: ink }]}>
                      {option.name}
                    </Text>
                    <Text
                      {...voice}
                      style={[
                        typeStyle('voiceDescription', tokens),
                        styles.description,
                        { color: ink },
                      ]}
                    >
                      {option.description}
                    </Text>
                  </PressedTile>
                </View>
              );
            })}
            {row.length === 1 && <View style={styles.cell} />}
          </View>
        ))}
      </View>
    </View>
  );
}

/** The voices two to a row, in their order. */
function pairs(voices: readonly NarratorVoice[]): readonly (readonly NarratorVoice[])[] {
  return Array.from({ length: Math.ceil(voices.length / 2) }, (_, row) =>
    voices.slice(row * 2, row * 2 + 2),
  );
}

/** The scene's dot raster, drawn once its size is known. */
function Halftone() {
  const [size, setSize] = useState<{ width: number; height: number }>();
  const measure = ({ nativeEvent }: LayoutChangeEvent) => {
    const { width, height } = nativeEvent.layout;
    setSize({ width, height });
  };
  return (
    <View style={StyleSheet.absoluteFill} onLayout={measure}>
      {size === undefined ? null : (
        <HalftoneGround id="narrator-voice-scene" width={size.width} height={size.height} />
      )}
    </View>
  );
}

/** One syllable of the sample Word: it lifts and lights up in its turn while the voice reads. */
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
  const tokens = useTokens();
  const lift = useSharedValue(0);
  useEffect(() => {
    if (!moving) {
      cancelAnimation(lift);
      lift.value = 0;
      return;
    }
    const half = drawing.syllableLiftDuration / 2;
    lift.value = withDelay(
      index * drawing.syllableStep,
      withSequence(withTiming(1, { duration: half }), withTiming(0, { duration: half })),
    );
  }, [moving, index, lift]);
  // At rest the syllable keeps its own colour; it lights up only while it lifts.
  const motion = useAnimatedStyle(() => {
    const transform = [{ translateY: -lift.value * drawing.syllableLift }];
    return lift.value === 0
      ? { transform }
      : { transform, color: interpolateColor(lift.value, [0, 1], [color, lit]) };
  });
  return (
    <Animated.Text
      allowFontScaling={false}
      importantForAccessibility="no"
      style={[typeStyle('voiceSample', tokens), { color }, motion]}
    >
      {text}
    </Animated.Text>
  );
}

/** One bar beside the play button: it swings while the voice reads and stands at full height otherwise. */
function Bar({ index, moving, color }: { index: number; moving: boolean; color: string }) {
  const share = drawing.barShares[index % drawing.barShares.length] ?? 1;
  const scale = useSharedValue(1);
  useEffect(() => {
    if (!moving) {
      cancelAnimation(scale);
      scale.value = 1;
      return;
    }
    scale.value = drawing.barRest;
    scale.value = withDelay(
      index * drawing.barDelay,
      withRepeat(
        withTiming(1, { duration: drawing.barSwing + (index % 3) * drawing.barSwingStep }),
        -1,
        true,
      ),
    );
  }, [moving, index, scale]);
  const motion = useAnimatedStyle(() => ({ transform: [{ scaleY: scale.value }] }));
  return (
    <Animated.View
      style={[styles.bar, { height: share * drawing.barsHeight, backgroundColor: color }, motion]}
    />
  );
}

const styles = StyleSheet.create({
  scene: {
    marginHorizontal: space[4],
    borderRadius: drawing.sceneRadius,
    overflow: 'hidden',
    paddingTop: drawing.scenePaddingTop,
    paddingHorizontal: drawing.scenePaddingHorizontal,
    paddingBottom: drawing.scenePaddingBottom,
    gap: drawing.sceneGap,
  },
  syllables: { flexDirection: 'row', gap: drawing.syllableGap },
  player: { flexDirection: 'row', alignItems: 'center', gap: drawing.playGap },
  play: {
    width: drawing.play,
    height: drawing.play,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bars: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: drawing.barsGap,
    height: drawing.barsHeight,
  },
  bar: { flex: 1 },
  choose: {
    paddingTop: drawing.choosePaddingTop,
    paddingBottom: drawing.choosePaddingBottom,
    paddingHorizontal: space[5],
  },
  tiles: { paddingHorizontal: space[4], gap: drawing.tileGap },
  row: { flexDirection: 'row', gap: drawing.tileGap },
  cell: { flex: 1 },
  tile: {
    height: drawing.tile,
    paddingHorizontal: drawing.tilePaddingHorizontal,
    justifyContent: 'center',
    alignItems: 'flex-start',
    gap: drawing.tileLineGap,
  },
  tileBorder: { borderWidth: StyleSheet.hairlineWidth },
  description: { opacity: drawing.descriptionOpacity },
});
