import { StyleSheet, Text, View } from 'react-native';

import { OrnamentBand } from './DecorSlots';
import { useEdition } from './EditionProvider';
import {
  guideStepBadge,
  overlineType,
  space,
  typeSize,
  widgetDrawingType,
  withAlpha,
} from './tokens';
import { InvertedTokens, useTokens } from './TokensProvider';

/** How far the largest text sizes of iOS may scale a step's title and hint, so no word breaks and the hint stays under its title. */
const STEP_MAX_FONT_SCALE = 1.3;

/** The home screen's wallpaper in the drawing: a picture of the phone, not an Edition token. */
const WALLPAPER = '#3F3128';
/** The drawing's app icons: white over the wallpaper. */
const APP_ICON_FILL = withAlpha('#FFFFFF', 0.16);
const APP_ICON_RADIUS = 12;
const WIDGET_RADIUS = 22;
/** The medium widget's width over its height, from the design's 364 × 170. */
const MEDIUM_ASPECT_RATIO = 364 / 170;

/** One numbered step of the widget guide: its number in a square, what to do and a hint under it. */
export function GuideStep({
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
export function WidgetDrawing({
  sizes,
  mode,
  lemma,
  definition,
  testID,
}: {
  /** The caption under the widgets, e.g. «Малий · Середній». */
  sizes: string;
  mode: string;
  lemma: string;
  definition: string;
  testID?: string;
}) {
  const { fontFamilies, radii } = useTokens();
  const { voice } = useEdition();
  return (
    <View
      testID={testID}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.stage, { backgroundColor: WALLPAPER, borderRadius: radii.sheet }]}
    >
      <InvertedTokens>
        <View style={styles.topRow}>
          <SampleWidget size="small" mode={mode} lemma={lemma} definition={definition} />
          <View style={styles.icons}>
            {[0, 1].map((row) => (
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
        {...voice}
        allowFontScaling={false}
        style={[styles.caption, { color: withAlpha('#FFFFFF', 0.7), fontFamily: fontFamilies.ui }]}
      >
        {sizes}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  step: { flexDirection: 'row', gap: space[4], paddingVertical: space[4] },
  badge: {
    width: guideStepBadge.size,
    height: guideStepBadge.size,
    borderRadius: guideStepBadge.radius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeNumber: { fontSize: typeSize.body, fontWeight: '700' },
  stepText: { flex: 1, gap: space[1] },
  stepTitle: { fontSize: typeSize.button + 1, fontWeight: '700' },
  stepHint: { fontSize: typeSize.body, lineHeight: typeSize.body * 1.4 },
  stage: { padding: space[4], gap: space[3] },
  topRow: { flexDirection: 'row', gap: space[3] },
  icons: { flex: 1, justifyContent: 'space-between' },
  iconRow: { flexDirection: 'row', gap: space[3] },
  icon: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: APP_ICON_RADIUS,
    backgroundColor: APP_ICON_FILL,
  },
  widget: {
    justifyContent: 'space-between',
    padding: space[4],
    borderRadius: WIDGET_RADIUS,
    overflow: 'hidden',
  },
  smallWidget: { flex: 1, aspectRatio: 1 },
  mediumWidget: { aspectRatio: MEDIUM_ASPECT_RATIO },
  bandRow: { flexDirection: 'row' },
  widgetWord: { gap: space[1] },
  lemma: { fontSize: widgetDrawingType.lemma, fontWeight: '500' },
  line: { fontSize: widgetDrawingType.line, fontWeight: '500' },
  caption: { fontSize: typeSize.body, textAlign: 'center' },
});
