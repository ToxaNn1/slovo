import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';

import { useEdition } from '../providers/EditionProvider';
import { useTokens } from '../providers/TokensProvider';
import { codeCellDrawing, fontScaleCap, space, typeStyle } from '../tokens';

/**
 * A code of a few digits in as many cells, drawn over one hidden field that
 * takes the typing. The field is the one a one-time code needs, so mail and
 * SMS autofill keep filling it and a paste fills every cell at once; what is
 * not a digit is dropped and the code stops at its last cell. VoiceOver reads
 * the field by its label and skips the cells. The cell to type next is ringed
 * in ink, every cell in the accent while there is a problem.
 */
export function CodeCells({
  label,
  digits,
  value,
  onChangeText,
  problem = false,
  busy = false,
  autoFocus,
  testID,
}: {
  /** What VoiceOver reads as the field's name. */
  label: string;
  /** How many cells, the length of the code. */
  digits: number;
  value: string;
  onChangeText: (code: string) => void;
  /** Whether the code typed has a problem, said in a line beside the cells. */
  problem?: boolean | undefined;
  /** Whether the request of the code is on the way. */
  busy?: boolean | undefined;
  autoFocus?: boolean | undefined;
  testID: string;
}) {
  const tokens = useTokens();
  const { colors } = tokens;
  const { voice } = useEdition();
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.row}>
      <View
        style={styles.cells}
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {Array.from({ length: digits }, (_, index) => (
          <View
            key={index}
            style={[
              styles.cell,
              {
                backgroundColor: colors.surfaceSunken,
                borderColor: problem
                  ? colors.accent
                  : focused && index === Math.min(value.length, digits - 1)
                    ? colors.ink
                    : colors.line,
              },
            ]}
          >
            <Text
              testID={`${testID}-cell-${String(index)}`}
              maxFontSizeMultiplier={fontScaleCap.number}
              style={[typeStyle('goalNumber', tokens), { color: colors.ink }]}
            >
              {value[index] ?? ''}
            </Text>
          </View>
        ))}
      </View>
      <TextInput
        testID={testID}
        accessibilityLabel={label}
        accessibilityState={{ busy }}
        {...voice}
        value={value}
        onChangeText={(typed) => {
          onChangeText(typed.replace(/\D/g, '').slice(0, digits));
        }}
        onFocus={() => {
          setFocused(true);
        }}
        onBlur={() => {
          setFocused(false);
        }}
        editable={!busy}
        autoFocus={autoFocus}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        caretHidden
        style={[StyleSheet.absoluteFill, styles.hidden]}
      />
      {busy && <ActivityIndicator style={styles.busy} color={colors.muted} />}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { justifyContent: 'center' },
  cells: { flexDirection: 'row', gap: space[2] },
  cell: {
    flex: 1,
    height: codeCellDrawing.height,
    borderRadius: codeCellDrawing.radius,
    borderWidth: codeCellDrawing.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Not opacity 0: iOS may skip autofill for a field it draws as invisible.
  hidden: { opacity: 0.02, color: 'transparent' },
  busy: { position: 'absolute', right: -space[5] },
});
