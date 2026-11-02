import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useEdition } from '../providers/EditionProvider';
import { minTouchTarget, segmentedDrawing } from '../tokens';
import { useTokens } from '../providers/TokensProvider';

/** The slack above and below a segment up to the smallest tap area. */
const HIT_SLOP = {
  top: (minTouchTarget - segmentedDrawing.segmentHeight) / 2,
  bottom: (minTouchTarget - segmentedDrawing.segmentHeight) / 2,
};

/** A segment's label stops growing here, so it never breaks a word at the largest text sizes. */
const LABEL_MAX_FONT_SCALE = 1.3;

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
  const { colors, fontFamilies } = useTokens();
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
              maxFontSizeMultiplier={LABEL_MAX_FONT_SCALE}
              style={[
                styles.label,
                { color: isSelected ? colors.background : colors.ink, fontFamily: fontFamilies.ui },
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
  label: { fontSize: segmentedDrawing.labelSize, fontWeight: '700' },
});
