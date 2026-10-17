import { useEffect } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';

import { useEdition } from '../providers/EditionProvider';
import { minTouchTarget, space, typeSize } from '../tokens';
import { useTokens } from '../providers/TokensProvider';

/**
 * A text field under its label, with the problem of what was typed, if any,
 * in one line under it, which VoiceOver announces each time it shows. While
 * its request is on the way it shows a spinner and takes no typing.
 */
export function TextField({
  label,
  value,
  onChangeText,
  problem,
  problemCause,
  busy = false,
  editable = true,
  testID,
  ...input
}: {
  /** The label over the field, which VoiceOver reads as its name. */
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  /** Why what was typed didn't do what the reader asked, in the Edition's words. */
  problem?: string | undefined;
  /** What the problem came with, such as the state it is part of: a new one announces the same problem again. */
  problemCause?: unknown;
  /** Whether the request of what was typed is on the way. */
  busy?: boolean | undefined;
  editable?: boolean;
  testID: string;
} & Pick<
  TextInputProps,
  | 'autoComplete'
  | 'autoFocus'
  | 'keyboardType'
  | 'maxLength'
  | 'onSubmitEditing'
  | 'returnKeyType'
  | 'textContentType'
>) {
  const { colors, fontFamilies, radii } = useTokens();
  const { voice } = useEdition();
  return (
    <View style={styles.field}>
      <Text {...voice} style={[styles.label, { color: colors.muted, fontFamily: fontFamilies.ui }]}>
        {label}
      </Text>
      <View
        style={[
          styles.box,
          {
            backgroundColor: editable ? colors.surface : colors.surfaceSunken,
            borderColor: problem === undefined ? colors.line : colors.destructive,
            borderRadius: radii.button,
          },
        ]}
      >
        <TextInput
          testID={testID}
          accessibilityLabel={label}
          accessibilityState={{ busy, disabled: !editable }}
          {...voice}
          {...input}
          value={value}
          onChangeText={onChangeText}
          editable={editable && !busy}
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          placeholderTextColor={colors.muted}
          selectionColor={colors.accent}
          style={[styles.input, { color: colors.ink, fontFamily: fontFamilies.ui }]}
        />
        {busy && <ActivityIndicator color={colors.muted} />}
      </View>
      <ProblemLine testID={`${testID}-problem`} problem={problem} cause={problemCause} />
    </View>
  );
}

/**
 * The one line that says why the last request didn't do what the reader
 * asked, under its field or its buttons, which VoiceOver announces each time
 * it shows. Without a problem it draws nothing.
 */
export function ProblemLine({
  problem,
  cause,
  testID,
}: {
  problem: string | undefined;
  /**
   * What the problem came with, such as the state it is part of: a new one
   * announces the same problem again, as when a second try meets it at once.
   */
  cause?: unknown;
  testID: string;
}) {
  const { colors, fontFamilies } = useTokens();
  const { voice } = useEdition();

  useEffect(() => {
    if (problem !== undefined) AccessibilityInfo.announceForAccessibility(problem);
  }, [problem, cause]);

  if (problem === undefined) return null;
  return (
    <Text
      testID={testID}
      {...voice}
      style={[styles.problem, { color: colors.ink, fontFamily: fontFamilies.ui }]}
    >
      {problem}
    </Text>
  );
}

const styles = StyleSheet.create({
  field: { gap: space[2] },
  label: { fontSize: typeSize.caption, fontWeight: '600' },
  box: {
    minHeight: minTouchTarget + space[2],
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    paddingHorizontal: space[4],
    borderWidth: 1,
  },
  input: { flex: 1, alignSelf: 'stretch', fontSize: typeSize.listItem },
  problem: { fontSize: typeSize.caption, fontWeight: '600' },
});
