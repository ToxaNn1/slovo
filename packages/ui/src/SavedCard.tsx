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
 * button with its full count.
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
  onPress: () => void;
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
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      {...voice}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        primary
          ? { backgroundColor: colors.ink, paddingVertical: 22, gap: space[4] }
          : { backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1 },
        { borderRadius: radii.card, opacity: pressed ? 0.85 : 1 },
      ]}
    >
      {primary ? <InvertedTokens>{content}</InvertedTokens> : content}
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

const styles = StyleSheet.create({
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
