import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useEdition } from '../providers/EditionProvider';
import { fontScaleCap, minTouchTarget, segmentedDrawing, typeStyle } from '../tokens';
import { useTokens } from '../providers/TokensProvider';

/** The slack above and below a segment up to the smallest tap area. */
const HIT_SLOP = {
  top: (minTouchTarget - segmentedDrawing.segmentHeight) / 2,
  bottom: (minTouchTarget - segmentedDrawing.segmentHeight) / 2,
};

export interface Segment<Value extends string> {
  value: Value;
  label: string;
  testID?: string;
}

/**
 * Picks one of a few values (Theme, font size): a sunken track with the
 * selected segment filled in ink.
 */
export function SegmentedControl<Value extends string>({
  segments,
  selected,
  onSelect,
  accessibilityLabel,
}: {
  segments: readonly Segment<Value>[];
  selected: Value;
  onSelect: (value: Value) => void;
  accessibilityLabel: string;
}) {
  const tokens = useTokens();
  const { colors } = tokens;
  const { voice } = useEdition();
  return (
    <View
      accessibilityLabel={accessibilityLabel}
      {...voice}
      style={[styles.track, { backgroundColor: colors.surfaceSunken }]}
    >
      {segments.map(({ value, label, testID }) => {
        const isSelected = value === selected;
        return (
          <Pressable
            key={value}
            testID={testID}
            accessibilityRole="button"
            // VoiceOver says what is chosen, e.g. "Тема: Темна".
            accessibilityLabel={`${accessibilityLabel}: ${label}`}
            accessibilityState={{ selected: isSelected }}
            {...voice}
            hitSlop={HIT_SLOP}
            onPress={() => {
              if (!isSelected) onSelect(value);
            }}
            style={[styles.segment, isSelected && { backgroundColor: colors.ink }]}
          >
            <Text
              maxFontSizeMultiplier={fontScaleCap.number}
              style={[
                typeStyle('segment', tokens),
                { color: isSelected ? colors.background : colors.ink },
              ]}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    gap: segmentedDrawing.gap,
    padding: segmentedDrawing.padding,
    borderRadius: segmentedDrawing.radius,
  },
  segment: {
    flex: 1,
    minHeight: segmentedDrawing.segmentHeight,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: segmentedDrawing.segmentRadius,
  },
});
