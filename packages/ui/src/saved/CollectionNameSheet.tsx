'use no memo';
// Reanimated code: the React Compiler skips this module (ADR 0059).
import { COLLECTION_NAME_MAX_LENGTH, collectionNameLength } from '@slovo/core';
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
import { Button } from '../primitives/Button';
import { TitledSheet } from '../primitives/TitledSheet';
import { collectionNameField, typeStyle } from '../tokens';
import { useNameSubmit } from './useNameSubmit';

const still = { reduceMotion: ReduceMotion.Never } as const;

/**
 * The sheet that names a Collection (board 09), for a new one («Нова
 * колекція», «Створити») or the one being renamed («Перейменувати», the field
 * filled, «Зберегти»). The field takes the focus and shows «N/40» on its
 * right, red past the limit, counted as the Core's name rules count. A tap on
 * the button or the keyboard's return key keeps the name; a refused name
 * stays in the field, which turns red and shakes (not under Reduce Motion),
 * with the reason under it. The cancel button, the scrim, a drag and
 * VoiceOver's escape gesture ask `onClose`; the caller turns `visible` off,
 * also once `onSubmit` resolves to nothing.
 */
export function CollectionNameSheet({
  visible,
  kind,
  initialName = '',
  onSubmit,
  onClose,
  onDismissed,
  testID = 'collection-name',
}: {
  visible: boolean;
  kind: 'new' | 'rename';
  initialName?: string | undefined;
  /** Resolves to the reason the name is refused, in the Edition's words, or to nothing once it is kept. */
  onSubmit: (name: string) => Promise<string | undefined>;
  onClose: () => void;
  onDismissed?: (() => void) | undefined;
  testID?: string;
}) {
  const tokens = useTokens();
  const { colors } = tokens;
  const { strings, voice } = useEdition();
  const { nameSheet, sheet } = strings.collections;
  const reduceMotion = useReduceMotion();
  const [name, setName] = useState(initialName);
  const { refusal, clearRefusal, submit } = useNameSubmit(
    onSubmit,
    'Could not keep the name of the Collection',
  );
  const shake = useSharedValue(0);
  const motion = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));

  // Each opening starts from the name the Collection has, with no refusal.
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

  const length = collectionNameLength(name);
  const tooLong = length > COLLECTION_NAME_MAX_LENGTH;
  return (
    <TitledSheet
      visible={visible}
      title={kind === 'new' ? nameSheet.newTitle : nameSheet.renameTitle}
      cancelLabel={nameSheet.cancel}
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
          accessibilityLabel={sheet.namePlaceholder}
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
          placeholder={sheet.namePlaceholder}
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
          {fill(nameSheet.counter, {
            count: String(length),
            max: String(COLLECTION_NAME_MAX_LENGTH),
          })}
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
        label={kind === 'new' ? nameSheet.create : nameSheet.save}
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
