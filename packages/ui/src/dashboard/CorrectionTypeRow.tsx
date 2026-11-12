'use no memo';
// Reanimated code: the React Compiler skips this module (ADR 0059).

import { fill, type Correction } from '@slovo/contracts';
import { withoutStress } from '@slovo/core';
import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View, type TextLayoutEvent } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { PressedTile } from '../primitives/PressedTile';
import { useCascade, type Cascade } from '../primitives/useCascade';
import { Wedge } from '../primitives/Wedge';
import { useEdition } from '../providers/EditionProvider';
import { useReduceMotion } from '../providers/useReduceMotion';
import { useSchemeColors, useTokens } from '../providers/TokensProvider';
import { motion, railScreen as place, typeStyle } from '../tokens';

/** The cards rise in one after another, the first a moment after the screen opens. */
const cascade: Cascade = { variant: 'rise', ...place.cascade, delay: place.cascadeDelay };
const popEasing = Easing.bezier(...motion.pop.easing);
const fadeEasing = Easing.bezier(...motion.reduceMotion.easing);

/**
 * One Correction on its type's screen (ADR 0076), a cream card as the board
 * draws it: the type's chip, «Так часто кажуть» over the non-standard form
 * struck through in red, and under it the ink «Відповідь» until it is
 * worked through; then the red block «Українською краще» with the standard
 * form, the main one first, and the explanation in its place. The cards rise
 * in one after another by `index` and the red block pops in as it shows;
 * under Reduce Motion each only fades in.
 */
export function CorrectionTypeRow({
  correction,
  workedThrough,
  index,
  onReveal,
}: {
  correction: Correction;
  workedThrough: boolean;
  /** The card's place in the list, from 0: it sets when the card rises in. */
  index: number;
  onReveal: () => void;
}) {
  const shown = useCascade(index, cascade);
  const tokens = useTokens();
  const { colors } = tokens;
  const keyInk = useSchemeColors('light').ink;
  const { strings, voice } = useEdition();
  const { id, correctionType, nonStandardForm, standardEquivalents, explanation } = correction;
  const [main, ...others] = standardEquivalents;
  const card = strings.correctionCard;
  return (
    <Animated.View testID={`correction-type-row-${id}-cascade`} style={shown}>
      <View
        testID={`correction-type-row-${id}`}
        style={[
          styles.card,
          {
            backgroundColor: colors.tile,
            borderColor: colors.line,
            shadowColor: colors.tileEdge,
          },
        ]}
      >
        <View style={[styles.chip, { backgroundColor: colors.surfaceSunken }]}>
          <Text {...voice} style={[typeStyle('railChip', tokens), { color: colors.ink }]}>
            {card.correctionTypes[correctionType]}
          </Text>
        </View>
        <View style={styles.said}>
          <Text {...voice} style={[typeStyle('railLabel', tokens), { color: colors.muted }]}>
            {card.nonStandard}
          </Text>
          <Struck label={withoutStress(nonStandardForm)}>{nonStandardForm}</Struck>
        </View>
        {workedThrough ? (
          <Revealed testID={`correction-type-revealed-${id}`}>
            <Text {...voice} style={[typeStyle('railLabel', tokens), { color: keyInk }]}>
              {card.standard}
            </Text>
            <Text
              {...voice}
              accessibilityLabel={withoutStress(main)}
              style={[typeStyle('railStandard', tokens), { color: keyInk }]}
            >
              {main}
            </Text>
            {others.length > 0 && (
              <Text {...voice} style={[typeStyle('railNote', tokens), { color: keyInk }]}>
                {fill(card.otherEquivalents, { equivalents: others.join(', ') })}
              </Text>
            )}
            <Text {...voice} style={[typeStyle('railNote', tokens), { color: keyInk }]}>
              {explanation}
            </Text>
          </Revealed>
        ) : (
          <PressedTile
            tone="inverse"
            depth="action"
            radius={place.button.radius}
            testID={`correction-type-reveal-${id}`}
            accessibilityLabel={strings.dashboard.correctionTypes.reveal}
            accessibilityLanguage={voice.accessibilityLanguage}
            onPress={onReveal}
            faceStyle={styles.button}
          >
            <Text
              {...voice}
              style={[typeStyle('railButton', tokens), { color: colors.background }]}
            >
              {strings.dashboard.correctionTypes.reveal}
            </Text>
          </PressedTile>
        )}
      </View>
    </Animated.View>
  );
}

/**
 * The red block «Українською краще», a little wider than the card, its top
 * falling to the left; it pops in as it shows, or under Reduce Motion fades in.
 */
function Revealed({ testID, children }: { testID: string; children: ReactNode }) {
  const { colors } = useTokens();
  const reduceMotion = useReduceMotion();
  const { pop } = place.revealed;
  const scale = useSharedValue(reduceMotion ? 1 : pop.from);
  const opacity = useSharedValue(reduceMotion ? 0 : 1);
  useEffect(() => {
    if (reduceMotion) {
      scale.value = 1;
      opacity.value = withTiming(1, {
        duration: motion.reduceMotion.duration,
        easing: fadeEasing,
        reduceMotion: ReduceMotion.Never,
      });
      return;
    }
    const leg = (to: number, duration: number) =>
      withTiming(to, { duration, easing: popEasing, reduceMotion: ReduceMotion.Never });
    scale.value = withSequence(
      leg(pop.peak, pop.duration * pop.peakAt),
      leg(1, pop.duration * (1 - pop.peakAt)),
    );
  }, [opacity, scale, reduceMotion, pop]);
  const drawn = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));
  return (
    <Animated.View testID={testID} style={[styles.revealed, drawn]}>
      <View pointerEvents="none" style={styles.backdrop}>
        <View style={styles.slant}>
          <Wedge points={place.revealed.topCut} color={colors.accent} width="100%" height="100%" />
        </View>
        <View style={[styles.ground, { backgroundColor: colors.accent }]} />
      </View>
      {children}
    </Animated.View>
  );
}

/** One line of laid-out text, as `onTextLayout` reports it. */
type TextLayoutLine = TextLayoutEvent['nativeEvent']['lines'][number];

/** The non-standard form with the board's thick red line through each of its lines. */
function Struck({ label, children }: { label: string; children: string }) {
  const tokens = useTokens();
  const { colors } = tokens;
  const { voice } = useEdition();
  const [lines, setLines] = useState<readonly TextLayoutLine[]>([]);
  return (
    <View>
      <Text
        {...voice}
        accessibilityLabel={label}
        onTextLayout={({ nativeEvent }) => {
          setLines(nativeEvent.lines);
        }}
        style={[typeStyle('railStruck', tokens), { color: colors.ink }]}
      >
        {children}
      </Text>
      {lines.map(({ x, y, width, height }, index) => (
        <View
          key={index}
          testID="correction-type-strike"
          pointerEvents="none"
          style={[
            styles.strike,
            {
              left: x,
              width,
              top: y + height * place.strike.at - place.strike.thickness / 2,
              backgroundColor: colors.accent,
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: place.card.padding,
    gap: place.card.gap,
    borderRadius: place.card.radius,
    borderWidth: place.card.line,
    // The board's hard edge: no blur, straight below.
    shadowOffset: { width: 0, height: place.card.edge },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  chip: {
    alignSelf: 'flex-start',
    paddingHorizontal: place.chip.paddingHorizontal,
    paddingVertical: place.chip.paddingVertical,
    borderRadius: place.chip.radius,
  },
  said: { gap: place.card.labelGap },
  strike: { position: 'absolute', height: place.strike.thickness },
  // The red ground reaches `overhang` past the card's text column on each side,
  // drawn behind the text so the text keeps the card's own width.
  backdrop: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: -place.revealed.overhang,
    right: -place.revealed.overhang,
  },
  slant: { height: place.revealed.slant },
  ground: { flex: 1 },
  revealed: {
    gap: place.revealed.gap,
    paddingTop: place.revealed.paddingTop,
    paddingBottom: place.revealed.padding,
    paddingHorizontal: place.revealed.padding - place.revealed.overhang,
  },
  button: {
    height: place.button.height,
    paddingHorizontal: place.button.paddingHorizontal,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
