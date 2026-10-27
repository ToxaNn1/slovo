'use no memo';
// Reanimated code: the React Compiler skips this module (ADR 0059).

import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { OrnamentBand } from '../decor/DecorSlots';
import { useEdition } from '../providers/EditionProvider';
import { guideStep, overlineType, space, typeSize, widgetDrawing, withAlpha } from '../tokens';
import { InvertedTokens, useTokens } from '../providers/TokensProvider';
import { useReduceMotionKnown } from '../providers/useReduceMotion';

/** How far the largest text sizes of iOS may scale a step's title and hint, so no word breaks and the hint stays under its title. */
const STEP_MAX_FONT_SCALE = 1.3;

/** One numbered step of the widget guide: its number in a square, what to do and a hint under it. */
function GuideStep({
  number,
  title,
  hint,
  last,
  testID,
}: {
  number: number;
  title: string;
  hint: string;
  /** The last step has no line under it. */
  last?: boolean;
  testID?: string;
}) {
  const { colors, fontFamilies } = useTokens();
  const { voice } = useEdition();
  return (
    <View
      testID={testID}
      accessible
      accessibilityLabel={`${String(number)}. ${title}. ${hint}`}
      {...voice}
      style={[styles.step, !last && { borderBottomColor: colors.line, borderBottomWidth: 1 }]}
    >
      <View style={[styles.badge, { backgroundColor: colors.accent }]}>
        <Text
          allowFontScaling={false}
          style={[styles.badgeNumber, { color: colors.background, fontFamily: fontFamilies.ui }]}
        >
          {number}
        </Text>
      </View>
      <View style={styles.stepText}>
        <Text
          maxFontSizeMultiplier={STEP_MAX_FONT_SCALE}
          style={[styles.stepTitle, { color: colors.ink, fontFamily: fontFamilies.ui }]}
        >
          {title}
        </Text>
        <Text
          maxFontSizeMultiplier={STEP_MAX_FONT_SCALE}
          style={[styles.stepHint, { color: colors.muted, fontFamily: fontFamilies.ui }]}
        >
          {hint}
        </Text>
      </View>
    </View>
  );
}

/** A widget of the drawing: the mode's name, the Word and the band, and the short line on the medium one. */
function SampleWidget({
  size,
  mode,
  lemma,
  definition,
}: {
  size: 'small' | 'medium';
  mode: string;
  lemma: string;
  definition: string;
}) {
  const { colors, fontFamilies } = useTokens();
  return (
    <View
      style={[
        styles.widget,
        size === 'small' ? styles.smallWidget : styles.mediumWidget,
        { backgroundColor: colors.background },
      ]}
    >
      <Text
        allowFontScaling={false}
        numberOfLines={1}
        style={[overlineType, { color: colors.decor, fontFamily: fontFamilies.ui }]}
      >
        {mode}
      </Text>
      <View style={styles.widgetWord}>
        <Text
          allowFontScaling={false}
          numberOfLines={1}
          style={[styles.lemma, { color: colors.ink, fontFamily: fontFamilies.word }]}
        >
          {lemma}
        </Text>
        {size === 'medium' && (
          <Text
            allowFontScaling={false}
            numberOfLines={1}
            style={[styles.line, { color: colors.inkSecondary, fontFamily: fontFamilies.word }]}
          >
            {definition}
          </Text>
        )}
      </View>
      {/* The band grows along its row, so it keeps its own height in the widget's column. */}
      <View style={styles.bandRow}>
        <OrnamentBand />
      </View>
    </View>
  );
}

/**
 * The widget guide's drawing: a home screen with the small and the medium
 * widget on it, over a caption that names the sizes. The widgets are drawn
 * in the other colour scheme than the screen, as the design has them. The
 * drawing is a picture: VoiceOver skips it, the steps carry the guide.
 */
function WidgetDrawing({
  caption,
  mode,
  lemma,
  definition,
  testID,
}: {
  /** The caption under the widgets, e.g. «Малий · Середній». */
  caption: string;
  mode: string;
  lemma: string;
  definition: string;
  testID?: string;
}) {
  const { fontFamilies, radii } = useTokens();
  return (
    <View
      testID={testID}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.stage,
        { backgroundColor: widgetDrawing.wallpaper, borderRadius: radii.sheet },
      ]}
    >
      <InvertedTokens>
        <View style={styles.topRow}>
          <SampleWidget size="small" mode={mode} lemma={lemma} definition={definition} />
          <View style={styles.icons}>
            {Array.from({ length: widgetDrawing.iconRows }, (_, row) => (
              <View key={row} style={styles.iconRow}>
                <View style={styles.icon} />
                <View style={styles.icon} />
              </View>
            ))}
          </View>
        </View>
        <SampleWidget size="medium" mode={mode} lemma={lemma} definition={definition} />
      </InvertedTokens>
      <Text
        allowFontScaling={false}
        style={[
          styles.caption,
          {
            color: withAlpha(widgetDrawing.white, widgetDrawing.captionOpacity),
            fontFamily: fontFamilies.ui,
          },
        ]}
      >
        {caption}
      </Text>
    </View>
  );
}

/** How long a step of the widget guide takes to come in. */
const STEP_IN = {
  duration: 400,
  easing: Easing.out(Easing.quad),
  reduceMotion: ReduceMotion.Never,
};
/** How long after the step before it the next step starts to come in. */
const STEP_STAGGER_MS = 600;
/** How far below its place a step starts to rise from. */
const STEP_RISE = space[3];

/**
 * A step of the widget guide that rises and fades in at its turn, or stands
 * still from the start with Reduce Motion. It waits, unseen, until the system
 * says whether Reduce Motion is on, so the motion never starts for a reader who
 * turned it off.
 */
function AnimatedGuideStep({
  index,
  testID,
  ...step
}: Parameters<typeof GuideStep>[0] & { index: number }) {
  const reduceMotion = useReduceMotionKnown();
  /** 0 before the step comes in, 1 once it is in place. */
  const shown = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion === undefined) return;
    shown.value = reduceMotion ? 1 : withDelay(index * STEP_STAGGER_MS, withTiming(1, STEP_IN));
    // The shared value is stable, so only the answer about Reduce Motion starts the motion.
  }, [reduceMotion, index, shown]);
  const style = useAnimatedStyle(() => ({
    opacity: shown.value,
    transform: [{ translateY: (1 - shown.value) * STEP_RISE }],
  }));
  return (
    <Animated.View testID={testID} style={style}>
      <GuideStep {...step} />
    </Animated.View>
  );
}

/**
 * The widget guide: the drawing of the widgets over the steps, in the order
 * the reader does them, each coming in at its turn (still with Reduce Motion).
 * Settings › «Як додати віджет» and the widget hint on the Game's result both
 * show it. The `testID` names the drawing (`${testID}-drawing`) and the steps
 * (`${testID}-step-1` on).
 */
export function WidgetGuide({
  steps,
  caption,
  mode,
  lemma,
  definition,
  testID,
}: {
  steps: readonly { readonly title: string; readonly hint: string }[];
  /** The caption under the widgets, e.g. «Малий · Середній». */
  caption: string;
  mode: string;
  lemma: string;
  definition: string;
  testID: string;
}) {
  return (
    <View>
      <WidgetDrawing
        testID={`${testID}-drawing`}
        caption={caption}
        mode={mode}
        lemma={lemma}
        definition={definition}
      />
      <View style={styles.steps}>
        {steps.map((step, index) => (
          <AnimatedGuideStep
            key={index}
            index={index}
            testID={`${testID}-step-${String(index + 1)}`}
            number={index + 1}
            title={step.title}
            hint={step.hint}
            last={index === steps.length - 1}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  steps: { marginTop: space[4] },
  step: { flexDirection: 'row', gap: space[4], paddingVertical: space[4] },
  badge: {
    width: guideStep.badge,
    height: guideStep.badge,
    borderRadius: guideStep.badgeRadius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeNumber: { fontSize: typeSize.body, fontWeight: '700' },
  stepText: { flex: 1, gap: space[1] },
  stepTitle: { fontSize: guideStep.titleSize, fontWeight: '700' },
  stepHint: { fontSize: typeSize.body, lineHeight: typeSize.body * guideStep.hintLeading },
  stage: { padding: space[4], gap: space[3] },
  topRow: { flexDirection: 'row', gap: space[3] },
  icons: { flex: 1, justifyContent: 'space-between' },
  iconRow: { flexDirection: 'row', gap: space[3] },
  icon: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: widgetDrawing.iconRadius,
    backgroundColor: withAlpha(widgetDrawing.white, widgetDrawing.iconOpacity),
  },
  widget: {
    justifyContent: 'space-between',
    padding: space[4],
    borderRadius: widgetDrawing.widgetRadius,
    overflow: 'hidden',
  },
  smallWidget: { flex: 1, aspectRatio: 1 },
  mediumWidget: { aspectRatio: widgetDrawing.mediumAspectRatio },
  bandRow: { flexDirection: 'row' },
  widgetWord: { gap: space[1] },
  lemma: { fontSize: widgetDrawing.lemmaSize, fontWeight: '500' },
  line: { fontSize: widgetDrawing.lineSize, fontWeight: '500' },
  caption: { fontSize: typeSize.body, textAlign: 'center' },
});
