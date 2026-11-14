import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { SegmentedControl } from '../primitives/SegmentedControl';
import { InvertedTokens, useTokens } from '../providers/TokensProvider';
import { space } from '../tokens';
import { SampleWidget, type SampleWidgetSize } from './WidgetGuide';

/** How wide each preview is drawn, the board's 120, 250 and 160 points. */
const WIDTHS: Record<SampleWidgetSize, number> = { small: 120, medium: 250, lockScreen: 160 };

/** The preview the screen opens on, as the board has it. */
const FIRST: SampleWidgetSize = 'medium';

/**
 * The widget previews of the Widgets screen: the widget drawn at the size the
 * reader picks, «Малий», «Середній» and, while the lock-screen widget is on,
 * «Екран блокування». A preview is only a look: the pick is kept by nothing
 * and marked with no ✓, since the reader picks a widget's size on the home
 * screen (ADR 0026). The drawing is a picture, so VoiceOver skips it. The
 * `testID` names each segment (`${testID}-small`) and the widget drawn
 * (`${testID}-widget-small`).
 */
export function WidgetPreviews({
  accessibilityLabel,
  names,
  lockScreen,
  mode,
  lemma,
  definition,
  testID,
}: {
  /** What VoiceOver calls the switcher before the preview's name, e.g. «Віджети». */
  accessibilityLabel: string;
  names: Readonly<Record<SampleWidgetSize, string>>;
  /** Whether the lock-screen preview is offered. */
  lockScreen: boolean;
  mode: string;
  lemma: string;
  definition: string;
  testID: string;
}) {
  const { colors, radii } = useTokens();
  const [shown, setShown] = useState<SampleWidgetSize>(FIRST);
  const sizes: readonly SampleWidgetSize[] = lockScreen
    ? ['small', 'medium', 'lockScreen']
    : ['small', 'medium'];
  // The lock-screen preview goes with its switch, so a pick of it falls back to the first.
  const size = sizes.includes(shown) ? shown : FIRST;
  return (
    <View style={styles.previews}>
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[styles.stage, { backgroundColor: colors.surfaceSunken, borderRadius: radii.sheet }]}
      >
        <InvertedTokens>
          <View style={[styles.place, { width: WIDTHS[size] }]}>
            <SampleWidget
              testID={`${testID}-widget-${size}`}
              size={size}
              mode={mode}
              lemma={lemma}
              definition={definition}
              style={styles.fill}
            />
          </View>
        </InvertedTokens>
      </View>
      <SegmentedControl
        accessibilityLabel={accessibilityLabel}
        segments={sizes.map((value) => ({
          value,
          label: names[value],
          testID: `${testID}-${value}`,
        }))}
        selected={size}
        onSelect={setShown}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  previews: { gap: space[3] },
  stage: { padding: space[4], minHeight: 170, alignItems: 'center', justifyContent: 'center' },
  place: { flexDirection: 'row' },
  fill: { flex: 1 },
});
