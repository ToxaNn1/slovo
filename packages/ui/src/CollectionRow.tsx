import { useRef, useState } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { useEdition } from './EditionProvider';
import { rowActionProps, SwipeableRow, type RowAction } from './SwipeableRow';
import { minTouchTarget, overlineType, space } from './tokens';
import { useTokens } from './TokensProvider';

/**
 * A Collection on the Collections screen: a card with its name over its
 * newest Lemmas, and how many Entries it holds on the right. Swipe actions
 * slide out inside the card and are VoiceOver actions too. Needs a
 * `GestureHandlerRootView` above it.
 */
export function CollectionRow({
  name,
  count,
  lemmas,
  accessibilityLabel,
  actions,
  testID,
}: {
  name: string;
  /** The Entries it holds, in the Edition's plural form, e.g. «17 записів». */
  count: string;
  /** What its newest Entries lead with, newest first; none for an empty Collection. */
  lemmas: readonly string[];
  /** The Collection as VoiceOver reads it: its name, its count and its Lemmas. */
  accessibilityLabel: string;
  actions: readonly RowAction[];
  testID: string;
}) {
  const { colors, fontFamilies, radii } = useTokens();
  const { voice } = useEdition();
  return (
    <SwipeableRow
      testID={testID}
      actions={actions}
      containerStyle={[
        styles.card,
        { borderColor: colors.line, borderRadius: radii.card, backgroundColor: colors.surface },
      ]}
    >
      <View
        testID={`${testID}-content`}
        accessible
        accessibilityLabel={accessibilityLabel}
        {...rowActionProps(actions)}
        {...voice}
        style={[styles.content, { backgroundColor: colors.surface }]}
      >
        <View style={styles.titleLine}>
          <Text style={[styles.name, { color: colors.ink, fontFamily: fontFamilies.ui }]}>
            {name}
          </Text>
          <Text style={[styles.count, { color: colors.muted, fontFamily: fontFamilies.ui }]}>
            {count}
          </Text>
        </View>
        {lemmas.length > 0 && (
          <Text
            style={[styles.lemmas, { color: colors.inkSecondary, fontFamily: fontFamilies.word }]}
          >
            {lemmas.join(' · ')}
          </Text>
        )}
      </View>
    </SwipeableRow>
  );
}

/**
 * The card in which a Collection is named: one for a new Collection and one
 * in place of a row being renamed. The name field takes the focus; the
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
  const { colors, fontFamilies, radii } = useTokens();
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
        style={[styles.overline, { color: colors.accent, fontFamily: fontFamilies.ui }]}
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
          styles.field,
          {
            backgroundColor: colors.surfaceSunken,
            borderRadius: radii.chip,
            color: colors.ink,
            fontFamily: fontFamilies.ui,
          },
        ]}
      />
      {refusal !== undefined && (
        <Text
          testID={`${testID}-refusal`}
          {...voice}
          style={[styles.refusal, { color: colors.destructive, fontFamily: fontFamilies.ui }]}
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
  content: { paddingHorizontal: 18, paddingVertical: 18, gap: space[2] },
  // At the largest text sizes the count drops under the name instead of squeezing it.
  titleLine: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    columnGap: space[3],
  },
  name: { flexShrink: 1, fontSize: 17, fontWeight: '700' },
  count: { flexShrink: 0, fontSize: 14, fontWeight: '500' },
  lemmas: { fontSize: 22, lineHeight: 22 * 1.3 },
  editing: { paddingHorizontal: 18, paddingVertical: 16, gap: space[3] },
  overline: overlineType,
  field: { minHeight: 52, paddingHorizontal: space[4], fontSize: 18 },
  refusal: { fontSize: 14, fontWeight: '500' },
  add: {
    minHeight: minTouchTarget,
    minWidth: minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
