import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useEdition } from '../providers/EditionProvider';
import { fontScaleCap, minTouchTarget, segmentedDrawing, space, typeStyle } from '../tokens';
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
            {/* A label too long for the track shrinks rather than breaking onto a second line. */}
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
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
  // Each segment is its label and an equal share of the room left, so a long label
  // («Екран блокування») takes the room it needs and keeps to one line (check 15.11).
  segment: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 'auto',
    paddingHorizontal: space[2],
    minHeight: segmentedDrawing.segmentHeight,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: segmentedDrawing.segmentRadius,
  },
});
