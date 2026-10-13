import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useEdition } from './EditionProvider';
import { space } from './tokens';
import { InvertedTokens, useTokens } from './TokensProvider';

/** The header of a card: its name and its count. */
function Header({ title, count }: { title: string; count: number }) {
  const { colors, fontFamilies } = useTokens();
  return (
    <View style={styles.header}>
      <Text style={[styles.title, { color: colors.ink, fontFamily: fontFamilies.ui }]}>
        {title}
      </Text>
      <Text style={[styles.count, { color: colors.accent, fontFamily: fontFamilies.word }]}>
        {String(count)}
      </Text>
    </View>
  );
}

/**
 * One card of the Saved tab's overview: the name of a list and its count,
 * over what the list shows in brief. The `primary` card (Favorites) sits on
 * the ink fill and draws its content in the other colour scheme; the others
 * sit on the surface. A tap opens the list; VoiceOver reads the card as one
 * button with its full count. A card without `onPress` is no button yet (its
 * list comes with a later ticket): it is one element for VoiceOver with the
 * same label, and a tap does nothing.
 */
export function SavedCard({
  title,
  count,
  accessibilityLabel,
  primary = false,
  onPress,
  testID,
  children,
}: {
  title: string;
  count: number;
  /** The card as VoiceOver reads it, the count in full words, e.g. «Улюблене, 24 записи». */
  accessibilityLabel: string;
  primary?: boolean;
  onPress?: () => void;
  testID?: string;
  children?: ReactNode;
}) {
  const { colors, radii } = useTokens();
  const { voice } = useEdition();
  const content = (
    <>
      <Header title={title} count={count} />
      {children}
    </>
  );
  const cardStyle = [
    styles.card,
    primary
      ? { backgroundColor: colors.ink, paddingVertical: 22, gap: space[4] }
      : { backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1 },
    { borderRadius: radii.card },
  ];
  const inner = primary ? <InvertedTokens>{content}</InvertedTokens> : content;
  if (onPress === undefined)
    return (
      <View
        testID={testID}
        accessible
        accessibilityLabel={accessibilityLabel}
        {...voice}
        style={cardStyle}
      >
        {inner}
      </View>
    );
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      {...voice}
      onPress={onPress}
      style={({ pressed }) => [cardStyle, { opacity: pressed ? 0.85 : 1 }]}
    >
      {inner}
    </Pressable>
  );
}

/** The newest titles a list holds (Lemmas, standard equivalents), in one line that wraps, a dot between two. */
export function SavedCardTitles({ titles }: { titles: readonly string[] }) {
  const { colors, fontFamilies } = useTokens();
  if (titles.length === 0) return null;
  return (
    <View style={styles.titles}>
      {titles.map((title, index) => (
        // The dot goes with the title after it, so a line never ends on one.
        <View key={index} style={styles.titleItem}>
          {index > 0 && <Text style={[styles.titleText, { color: colors.muted }]}>·</Text>}
          <Text
            style={[
              styles.titleText,
              { color: colors.inkSecondary, fontFamily: fontFamilies.word },
            ]}
          >
            {title}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** A Collection on the Collections card: its name over its count, on the sunken fill. */
export function SavedCardCollection({
  name,
  count,
  accessibilityLabel,
  testID,
}: {
  name: string;
  /** The Entries it holds, in the Edition's plural form, e.g. «17 записів». */
  count: string;
  /** The Collection as VoiceOver reads it, e.g. «Для листів, 17 записів». */
  accessibilityLabel: string;
  testID?: string;
}) {
  const { colors, fontFamilies, radii } = useTokens();
  const { voice } = useEdition();
  return (
    <View
      testID={testID}
      accessible
      accessibilityLabel={accessibilityLabel}
      {...voice}
      style={[
        styles.collection,
        { backgroundColor: colors.surfaceSunken, borderRadius: radii.chip },
      ]}
    >
      <Text style={[styles.collectionName, { color: colors.ink, fontFamily: fontFamilies.ui }]}>
        {name}
      </Text>
      <Text style={[styles.collectionCount, { color: colors.muted, fontFamily: fontFamilies.ui }]}>
        {count}
      </Text>
    </View>
  );
}

/** The Collections of a card in one row, of one width each. */
export function SavedCardCollections({ children }: { children: ReactNode }) {
  return <View style={styles.collections}>{children}</View>;
}

const styles = StyleSheet.create({
  collections: { flexDirection: 'row', gap: space[3] },
  collection: { flex: 1, paddingHorizontal: space[3], paddingVertical: space[3], gap: space[1] },
  collectionName: { fontSize: 15, fontWeight: '700' },
  collectionCount: { fontSize: 14 },
  card: { padding: space[5], gap: 14, overflow: 'hidden' },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: space[3],
  },
  title: { flexShrink: 1, fontSize: 17, fontWeight: '700' },
  count: { fontSize: 30, fontWeight: '500' },
  titles: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: space[2] },
  titleItem: { flexDirection: 'row', alignItems: 'baseline', gap: space[2] },
  titleText: { fontSize: 18 },
});
