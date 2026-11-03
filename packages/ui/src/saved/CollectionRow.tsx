import { useRef, useState } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { useEdition } from '../providers/EditionProvider';
import { rowActionProps, SwipeableRow, type RowAction } from '../primitives/SwipeableRow';
import { cardSpace, entryRow, minTouchTarget, space, typeStyle } from '../tokens';
import { useTokens } from '../providers/TokensProvider';

/** The fills of the cards in turn: red, ink, sunken. */
const FILLS = ['accent', 'ink', 'sunken'] as const;

type Fill = (typeof FILLS)[number];

function fillAt(index: number): Fill {
  return FILLS[index % FILLS.length] ?? 'accent';
}

/**
 * The paint of the Collection at a place among the Collections: its ground, the
 * ink of its text and the colour of its mark. The Collections' rows take it in turn: red, ink, then sunken.
 */
function useCollectionPaint(index: number): { ground: string; ink: string; mark: string } {
  const { colors, colorScheme } = useTokens();
  // The design's dark ink, the same in both Themes: the light ink, the dark ground.
  const darkInk = colorScheme === 'light' ? colors.ink : colors.background;
  return {
    accent: { ground: colors.accent, ink: darkInk, mark: darkInk },
    ink: { ground: colors.ink, ink: colors.background, mark: colors.accent },
    sunken: { ground: colors.surfaceSunken, ink: colors.ink, mark: colors.accent },
  }[fillAt(index)];
}

/**
 * A Collection on the Collections screen: a card with its name over its
 * newest Lemmas, and how many Entries it holds on the right. The cards take
 * their fill in turn by their place. A tap opens the
 * Collection; swipe actions slide out inside the card and are VoiceOver
 * actions too, and the «…» button at the right offers the same actions in a
 * menu. Needs a `GestureHandlerRootView` above it.
 */
export function CollectionRow({
  index,
  name,
  count,
  lemmas,
  accessibilityLabel,
  actions,
  more,
  onPress,
  testID,
}: {
  /** The row's place among the rows, which picks its fill. */
  index: number;
  name: string;
  /** The Entries it holds, in the Edition's plural form, e.g. «17 записів». */
  count: string;
  /** What its newest Entries lead with, newest first; none for an empty Collection. */
  lemmas: readonly string[];
  /** The Collection as VoiceOver reads it: its name, its count and its Lemmas. */
  accessibilityLabel: string;
  actions: readonly RowAction[];
  /** The «…» button: what VoiceOver reads for it, and what a tap does (opens the menu). */
  more: { label: string; onPress: () => void };
  /** Opens the Collection. */
  onPress: () => void;
  testID: string;
}) {
  const tokens = useTokens();
  const { radii } = tokens;
  const { voice } = useEdition();
  const paint = useCollectionPaint(index);
  return (
    <SwipeableRow
      testID={testID}
      actions={actions}
      containerStyle={[styles.filled, { borderRadius: radii.card, backgroundColor: paint.ground }]}
    >
      <View style={styles.line}>
        <Pressable
          testID={`${testID}-content`}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          {...rowActionProps(actions)}
          {...voice}
          onPress={onPress}
          style={({ pressed }) => [
            styles.content,
            { backgroundColor: paint.ground },
            pressed && styles.pressed,
          ]}
        >
          <View style={styles.titleLine}>
            <Text
              style={[typeStyle('collectionRowName', tokens), styles.name, { color: paint.ink }]}
            >
              {name}
            </Text>
            <Text
              style={[typeStyle('collectionRowCount', tokens), styles.count, { color: paint.ink }]}
            >
              {count}
            </Text>
          </View>
          {lemmas.length > 0 && (
            <Text style={[typeStyle('collectionLemmas', tokens), { color: paint.ink }]}>
              {lemmas.join(' · ')}
            </Text>
          )}
        </Pressable>
        <Pressable
          testID={`${testID}-more`}
          accessibilityRole="button"
          accessibilityLabel={more.label}
          {...voice}
          hitSlop={space[2]}
          onPress={more.onPress}
          style={styles.more}
        >
          <Svg width={20} height={20} viewBox="0 0 20 20">
            {[4, 10, 16].map((cx) => (
              <Circle key={cx} cx={cx} cy={10} r={1.75} fill={paint.ink} />
            ))}
          </Svg>
        </Pressable>
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
        style={[typeStyle('eyebrow', tokens), { color: colors.accent }]}
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
          style={[typeStyle('fieldProblem', tokens), { color: colors.destructive }]}
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
  filled: { overflow: 'hidden' },
  pressed: { opacity: entryRow.pressedOpacity },
  line: { flexDirection: 'row', alignItems: 'stretch' },
  content: {
    flex: 1,
    paddingHorizontal: cardSpace.collectionPadding,
    paddingVertical: cardSpace.collectionPadding,
    gap: space[2],
  },
  // At the largest text sizes the count drops under the name instead of squeezing it.
  titleLine: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    columnGap: space[3],
  },
  name: { flexShrink: 1 },
  count: { flexShrink: 0 },
  more: {
    minWidth: minTouchTarget,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: cardSpace.collectionPadding,
  },
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
