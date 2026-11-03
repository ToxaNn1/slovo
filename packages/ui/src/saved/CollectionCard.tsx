import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useEdition } from '../providers/EditionProvider';
import { useTokens } from '../providers/TokensProvider';
import { rowActionProps, type RowAction } from '../primitives/SwipeableRow';
import { Wedge } from '../primitives/Wedge';
import { collectionCard, collectionMarks, entryRow, typeStyle } from '../tokens';

/** The fills of the cards in turn: red, ink, sunken. */
const FILLS = ['accent', 'ink', 'sunken'] as const;

type Fill = (typeof FILLS)[number];

function fillAt(index: number): Fill {
  return FILLS[index % FILLS.length] ?? 'accent';
}

/**
 * The paint of the Collection at a place among the Collections: its ground, the
 * ink of its text and the colour of its mark, in turn: red, ink, then sunken.
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

/** An action a card offers to VoiceOver as a custom action, such as rename or delete. */
export type CollectionCardAction = Pick<RowAction, 'name' | 'accessibilityLabel' | 'onPress'>;

/**
 * A Collection's card on the Collections screen: its mark, its name in two
 * lines at most and how many Entries it holds. The cards take their fill in
 * turn by their place, red, ink, then sunken, and their mark in turn too. A
 * tap opens the Collection, a long press its menu; the actions go to
 * VoiceOver as custom actions.
 */
export function CollectionCard({
  index,
  name,
  count,
  accessibilityLabel,
  actions,
  onPress,
  onLongPress,
  testID,
}: {
  /** The card's place among the cards, which picks its fill and its mark. */
  index: number;
  name: string;
  /** The Entries it holds, in the Edition's plural form, e.g. «17 записів». */
  count: string;
  /** The Collection as VoiceOver reads it, e.g. «Для листів, 17 записів». */
  accessibilityLabel: string;
  actions: readonly CollectionCardAction[];
  /** Opens the Collection. */
  onPress: () => void;
  /** Opens the Collection's menu. */
  onLongPress: () => void;
  testID?: string;
}) {
  const tokens = useTokens();
  const { radii } = tokens;
  const { voice } = useEdition();
  const paint = useCollectionPaint(index);
  const mark = collectionMarks[index % collectionMarks.length] ?? collectionMarks[0];
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      {...rowActionProps(actions)}
      {...voice}
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: paint.ground, borderRadius: radii.card },
        pressed && styles.pressed,
      ]}
    >
      <Wedge
        points={mark}
        color={paint.mark}
        width={collectionCard.mark}
        height={collectionCard.mark}
      />
      <View style={styles.text}>
        <Text
          numberOfLines={2}
          style={[typeStyle('collectionCardName', tokens), { color: paint.ink }]}
        >
          {name}
        </Text>
        <Text
          numberOfLines={1}
          style={[typeStyle('collectionCardCount', tokens), styles.count, { color: paint.ink }]}
        >
          {count}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 0,
    height: collectionCard.height,
    padding: collectionCard.padding,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  pressed: { opacity: entryRow.pressedOpacity },
  text: { gap: collectionCard.textGap },
  count: { opacity: collectionCard.countOpacity },
});
