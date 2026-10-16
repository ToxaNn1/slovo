import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useEdition } from './EditionProvider';
import { minTouchTarget, typeSize } from './tokens';
import { useTokens } from './TokensProvider';

/** A segment's label stops growing here, so it never breaks a word at the largest text sizes. */
const LABEL_MAX_FONT_SCALE = 1.3;

export interface Segment<Value extends string> {
  value: Value;
  label: string;
  testID?: string;
}

/**
 * Picks one of a few values (Theme, font size): a track with the selected
 * segment raised on the surface colour.
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
  const { colors, fontFamilies, radii } = useTokens();
  const { voice } = useEdition();
  return (
    <View
      accessibilityLabel={accessibilityLabel}
      {...voice}
      style={[styles.track, { backgroundColor: colors.track, borderRadius: radii.button }]}
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
            onPress={() => {
              if (!isSelected) onSelect(value);
            }}
            style={[
              styles.segment,
              { borderRadius: Math.max(radii.button - 1, 0) },
              isSelected && [
                styles.selected,
                { backgroundColor: colors.surface, borderColor: colors.line },
              ],
            ]}
          >
            <Text
              maxFontSizeMultiplier={LABEL_MAX_FONT_SCALE}
              style={[
                styles.label,
                { color: colors.ink, fontFamily: fontFamilies.ui },
                isSelected && styles.selectedLabel,
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
  track: { flexDirection: 'row', padding: 3 },
  segment: {
    flex: 1,
    minHeight: minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
  },
  selected: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
  },
  label: { fontSize: typeSize.body, fontWeight: '500' },
  selectedLabel: { fontWeight: '600' },
});
