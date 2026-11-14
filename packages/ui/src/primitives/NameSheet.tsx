'use no memo';
// Reanimated code: the React Compiler skips this module (ADR 0059).
import { useState } from 'react';
import { StyleSheet, Text, TextInput } from 'react-native';
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { fill, useEdition } from '../providers/EditionProvider';
import { useTokens } from '../providers/TokensProvider';
import { useReduceMotion } from '../providers/useReduceMotion';
import { useNameSubmit } from './useNameSubmit';
import { collectionNameField, typeStyle } from '../tokens';
import { Button } from './Button';
import { TitledSheet } from './TitledSheet';

const still = { reduceMotion: ReduceMotion.Never } as const;

/**
 * The sheet of board 09 that names something: a Collection, the reader. The
 * field takes the focus and shows the `counter` on its right, red past `max`
 * as `lengthOf` counts. A tap on the button or the keyboard's return key
 * keeps the name; a refused name stays in the field, which turns red and
 * shakes (not under Reduce Motion), with the reason under it. The cancel
 * button, the scrim, a drag and VoiceOver's escape gesture ask `onClose`; the
 * caller turns `visible` off, also once `onSubmit` resolves to nothing.
 */
export function NameSheet({
  visible,
  title,
  placeholder,
  submitLabel,
  cancelLabel,
  counter,
  max,
  lengthOf,
  initialName = '',
  onSubmit,
  onClose,
  onDismissed,
  failure,
  testID,
}: {
  visible: boolean;
  title: string;
  placeholder: string;
  submitLabel: string;
  cancelLabel: string;
  /** The counter's words, with `{count}` and `{max}`. */
  counter: string;
  max: number;
  lengthOf: (name: string) => number;
  initialName?: string | undefined;
  /** Resolves to the reason the name is refused, in the Edition's words, or to nothing once it is kept. */
  onSubmit: (name: string) => Promise<string | undefined>;
  onClose: () => void;
  onDismissed?: (() => void) | undefined;
  /** What the log says when keeping the name fails. */
  failure: string;
  testID: string;
}) {
  const tokens = useTokens();
  const { colors } = tokens;
  const { voice } = useEdition();
  const reduceMotion = useReduceMotion();
  const [name, setName] = useState(initialName);
  const { refusal, clearRefusal, submit } = useNameSubmit(onSubmit, failure);
  const shake = useSharedValue(0);
  const motion = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));

  // Each opening starts from the name kept now, with no refusal.
  const [open, setOpen] = useState(visible);
  if (open !== visible) {
    setOpen(visible);
    if (visible) {
      setName(initialName);
      clearRefusal();
    }
  }

  async function keep() {
    const kept = await submit(name);
    if (kept || reduceMotion) return;
    const { shake: steps, shakeDuration } = collectionNameField;
    shake.value = withSequence(
      ...steps.map((to) => withTiming(to, { duration: shakeDuration / steps.length, ...still })),
    );
  }

  const length = lengthOf(name);
  const tooLong = length > max;
  return (
    <TitledSheet
      visible={visible}
      title={title}
      cancelLabel={cancelLabel}
      onClose={onClose}
      onDismissed={onDismissed}
      testID={testID}
    >
      <Animated.View
        testID={`${testID}-field`}
        style={[
          styles.field,
          {
            backgroundColor: colors.surface,
            borderColor: refusal === undefined ? colors.line : colors.accentText,
          },
          motion,
        ]}
      >
        <TextInput
          testID={`${testID}-input`}
          accessibilityLabel={placeholder}
          {...voice}
          autoFocus
          value={name}
          onChangeText={(text) => {
            setName(text);
            clearRefusal();
          }}
          onSubmitEditing={() => void keep()}
          // Keeps the field focused after a return, so a refused name can be corrected.
          submitBehavior="submit"
          placeholder={placeholder}
          placeholderTextColor={colors.muted}
          returnKeyType="done"
          autoCapitalize="sentences"
          autoCorrect={false}
          spellCheck={false}
          selectionColor={colors.accent}
          style={[typeStyle('fieldText', tokens), styles.input, { color: colors.ink }]}
        />
        <Text
          testID={`${testID}-counter`}
          {...voice}
          style={[
            typeStyle('collectionCardCount', tokens),
            { color: tooLong ? colors.accentText : colors.muted },
          ]}
        >
          {fill(counter, { count: String(length), max: String(max) })}
        </Text>
      </Animated.View>
      {refusal !== undefined && (
        <Text
          testID={`${testID}-refusal`}
          {...voice}
          style={[typeStyle('fieldProblem', tokens), styles.refusal, { color: colors.accentText }]}
        >
          {refusal}
        </Text>
      )}
      <Button
        variant="inverse"
        label={submitLabel}
        onPress={() => void keep()}
        testID={`${testID}-submit`}
      />
    </TitledSheet>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: collectionNameField.gap,
    height: collectionNameField.height,
    paddingHorizontal: collectionNameField.paddingHorizontal,
    borderRadius: collectionNameField.radius,
    borderWidth: collectionNameField.border,
  },
  input: { flex: 1, minWidth: 0, height: '100%' },
  refusal: { paddingHorizontal: collectionNameField.refusalInset },
});
