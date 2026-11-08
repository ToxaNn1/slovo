import { useRef, useState } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { useEdition } from '../providers/EditionProvider';
import { cardSpace, minTouchTarget, space, typeStyle } from '../tokens';
import { useTokens } from '../providers/TokensProvider';

/**
 * The card in which a Collection is named: one for a new Collection and one
 * for a Collection being renamed, over the Collections' cards. The name field takes the focus; the
 * keyboard's return key keeps the name, and leaving the field drops the
 * change (unless a name is being kept). A refused name stays in the field with the reason under it.
 */
export function CollectionNameField({
  overline,
  placeholder,
  initialName = '',
  onSubmit,
  onCancel,
  testID,
}: {
  /** The small capitals over the field, such as «Перейменування». */
  overline: string;
  /** The field's placeholder, which VoiceOver reads as its label. */
  placeholder: string;
  initialName?: string;
  /** Resolves to the reason the name is refused, in the Edition's words, or to nothing once it is kept. */
  onSubmit: (name: string) => Promise<string | undefined>;
  onCancel: () => void;
  testID: string;
}) {
  const tokens = useTokens();
  const { colors, radii } = tokens;
  const { voice } = useEdition();
  const [name, setName] = useState(initialName);
  const [refusal, setRefusal] = useState<string>();
  /** A second return while the first is being kept must not keep a second name. */
  const submitting = useRef(false);

  async function submit() {
    if (submitting.current) return;
    submitting.current = true;
    try {
      const reason = await onSubmit(name);
      setRefusal(reason);
      if (reason !== undefined) AccessibilityInfo.announceForAccessibility(reason);
    } catch (error) {
      // Nothing was kept: the field stays as the reader typed it, to try again.
      console.error('Could not keep the name of the Collection', error);
    } finally {
      submitting.current = false;
    }
  }

  return (
    <View
      testID={testID}
      style={[
        styles.card,
        styles.editing,
        { borderColor: colors.accent, borderRadius: radii.card, backgroundColor: colors.surface },
      ]}
    >
      <Text
        accessibilityRole="header"
        {...voice}
        style={[typeStyle('eyebrow', tokens), { color: colors.accentText }]}
      >
        {overline}
      </Text>
      <TextInput
        testID={`${testID}-input`}
        accessibilityLabel={placeholder}
        {...voice}
        autoFocus
        value={name}
        onChangeText={(text) => {
          setName(text);
          setRefusal(undefined);
        }}
        onSubmitEditing={() => void submit()}
        onBlur={() => {
          // A name being kept settles itself: it closes the field, or shows why it is refused.
          if (!submitting.current) onCancel();
        }}
        // Keeps the field focused after a return, so a refused name can be corrected.
        submitBehavior="submit"
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        returnKeyType="done"
        autoCapitalize="sentences"
        autoCorrect={false}
        spellCheck={false}
        selectionColor={colors.accent}
        style={[
          typeStyle('fieldText', tokens),
          styles.field,
          { backgroundColor: colors.surfaceSunken, borderRadius: radii.chip, color: colors.ink },
        ]}
      />
      {refusal !== undefined && (
        <Text
          testID={`${testID}-refusal`}
          {...voice}
          style={[typeStyle('fieldProblem', tokens), { color: colors.accentText }]}
        >
          {refusal}
        </Text>
      )}
    </View>
  );
}

/** The «+» at the top right of the Collections screen, which opens the field for a new Collection. */
export function NewCollectionButton({
  accessibilityLabel,
  onPress,
  testID,
}: {
  accessibilityLabel: string;
  onPress: () => void;
  testID?: string;
}) {
  const { colors } = useTokens();
  const { voice } = useEdition();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      {...voice}
      onPress={onPress}
      style={styles.add}
    >
      <Svg width={20} height={20} viewBox="0 0 20 20">
        <Path
          d="M10 2v16M2 10h16"
          fill="none"
          stroke={colors.accent}
          strokeWidth={2}
          strokeLinecap="round"
        />
      </Svg>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, overflow: 'hidden' },
  editing: {
    paddingHorizontal: cardSpace.collectionPadding,
    paddingVertical: space[4],
    gap: space[3],
  },
  field: { minHeight: 52, paddingHorizontal: space[4] },
  add: {
    minHeight: minTouchTarget,
    minWidth: minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
