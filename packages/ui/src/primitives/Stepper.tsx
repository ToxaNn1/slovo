import { StyleSheet, Text, View } from 'react-native';

import { useEdition } from '../providers/EditionProvider';
import { useTokens } from '../providers/TokensProvider';
import { fontScaleCap, stepperDrawing, typeStyle } from '../tokens';
import { PressedTile } from './PressedTile';

/**
 * A whole number from `min` to `max` on a sunken track, − on its left and +
 * on its right (board 11, 90). − takes no press at `min`, + none at `max`.
 */
export function Stepper({
  value,
  min,
  max,
  onChange,
  accessibilityLabel,
  fewerLabel,
  moreLabel,
  testID,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  accessibilityLabel: string;
  /** The − tile's label, e.g. «Менше днів». */
  fewerLabel: string;
  /** The + tile's label, e.g. «Більше днів». */
  moreLabel: string;
  /** The value's text carries `${testID}-value`. */
  testID?: string;
}) {
  const tokens = useTokens();
  const { colors } = tokens;
  const { voice } = useEdition();
  const glyph = [typeStyle('stepperGlyph', tokens), { color: colors.ink }];
  const tile = (label: string, mark: string, next: number, disabled: boolean) => (
    <PressedTile
      depth="action"
      radius={stepperDrawing.tileRadius}
      accessibilityLabel={label}
      disabled={disabled}
      faceStyle={styles.tile}
      onPress={() => {
        onChange(next);
      }}
    >
      <Text
        style={glyph}
        maxFontSizeMultiplier={fontScaleCap.number}
        importantForAccessibility="no"
      >
        {mark}
      </Text>
    </PressedTile>
  );
  return (
    <View
      testID={testID}
      accessibilityLabel={accessibilityLabel}
      {...voice}
      style={[styles.track, { backgroundColor: colors.surfaceSunken }]}
    >
      {tile(fewerLabel, '−', Math.max(min, value - 1), value <= min)}
      <Text
        testID={testID === undefined ? undefined : `${testID}-value`}
        accessibilityLabel={`${accessibilityLabel}: ${String(value)}`}
        {...voice}
        maxFontSizeMultiplier={fontScaleCap.number}
        style={[typeStyle('stepperValue', tokens), { color: colors.ink }]}
      >
        {value}
      </Text>
      {tile(moreLabel, '+', Math.min(max, value + 1), value >= max)}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: stepperDrawing.padding,
    borderRadius: stepperDrawing.radius,
  },
  tile: {
    width: stepperDrawing.tile,
    height: stepperDrawing.tile,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
