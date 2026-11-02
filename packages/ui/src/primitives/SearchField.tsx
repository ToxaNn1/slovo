import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import Svg, { Circle, Polygon } from 'react-native-svg';

import { useEdition } from '../providers/EditionProvider';
import { useTokens } from '../providers/TokensProvider';
import { minTouchTarget, searchFieldDrawing } from '../tokens';

/** The slack around the clear button up to the smallest tap area. */
const CLEAR_HIT_SLOP = (minTouchTarget - searchFieldDrawing.clear) / 2;

/**
 * The search field: a sunken box with a magnifier, the query, and while there
 * is a query a button that clears it. VoiceOver names the field by `label`,
 * which also shows as its placeholder.
 */
export function SearchField({
  label,
  value,
  onChangeText,
  testID,
  ...input
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  testID: string;
} & Pick<TextInputProps, 'autoFocus' | 'onSubmitEditing' | 'returnKeyType'>) {
  const { colors, fontFamilies } = useTokens();
  const { strings, voice } = useEdition();
  return (
    <View style={[styles.box, { backgroundColor: colors.surfaceSunken }]}>
      <Svg
        width={searchFieldDrawing.icon}
        height={searchFieldDrawing.icon}
        viewBox="0 0 24 24"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Circle cx={10} cy={10} r={7} fill="none" stroke={colors.ink} strokeWidth={3.5} />
        <Polygon points="15,17 18,14 24,20 21,23" fill={colors.ink} />
      </Svg>
      <TextInput
        testID={testID}
        accessibilityLabel={label}
        {...voice}
        {...input}
        value={value}
        onChangeText={onChangeText}
        placeholder={label}
        placeholderTextColor={colors.muted}
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        selectionColor={colors.accent}
        style={[styles.input, { color: colors.ink, fontFamily: fontFamilies.ui }]}
      />
      {value.length > 0 && (
        <Pressable
          testID={`${testID}-clear`}
          accessibilityRole="button"
          accessibilityLabel={strings.search.clear}
          {...voice}
          hitSlop={CLEAR_HIT_SLOP}
          onPress={() => {
            onChangeText('');
          }}
          style={[styles.clear, { backgroundColor: colors.ink }]}
        >
          <Svg
            width={searchFieldDrawing.clearIcon}
            height={searchFieldDrawing.clearIcon}
            viewBox="0 0 20 20"
          >
            <Polygon
              points="0,3 3,0 10,7 17,0 20,3 13,10 20,17 17,20 10,13 3,20 0,17 7,10"
              fill={colors.background}
            />
          </Svg>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    height: searchFieldDrawing.height,
    flexDirection: 'row',
    alignItems: 'center',
    gap: searchFieldDrawing.gap,
    paddingHorizontal: searchFieldDrawing.paddingHorizontal,
    borderRadius: searchFieldDrawing.radius,
  },
  input: {
    flex: 1,
    minWidth: 0,
    alignSelf: 'stretch',
    fontSize: searchFieldDrawing.inputSize,
    fontWeight: '500',
  },
  clear: {
    width: searchFieldDrawing.clear,
    height: searchFieldDrawing.clear,
    borderRadius: searchFieldDrawing.clearRadius,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
