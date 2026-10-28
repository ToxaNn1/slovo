import { withoutStress, type EntryRowModel } from '@slovo/core';
import { Pressable, StyleSheet, Text } from 'react-native';

import { entryRowSubtitle } from '../entries/entry-row-text';
import { useEdition } from '../providers/EditionProvider';
import { useTokens } from '../providers/TokensProvider';
import { space, typeSize } from '../tokens';
import { FeedNoticeCard } from './FeedNoticeCard';

/**
 * The Community Word («Слово тижня спільноти», ADR 0060): the Feed Notice
 * with how many readers added the Entry to Favorites last week, «додали 12
 * читачів» in the Edition's plural forms, and the mini card of the Entry, its
 * title over its second line as its row says them. A tap on the mini card
 * opens the Entry. Until the Entry's row is read, there is no mini card.
 */
export function CommunityWordCard({
  row,
  adds,
  onOpen,
}: {
  /** The row of the Entry, once read. */
  row: EntryRowModel | undefined;
  /** How many readers added the Entry to Favorites last week. */
  adds: number;
  onOpen: () => void;
}) {
  const { strings, count, voice } = useEdition();
  const { colors, radii, fontFamilies } = useTokens();
  const { title, added } = strings.feedNotices.communityWord;
  const subtitle = row === undefined ? undefined : entryRowSubtitle(strings.correctionCard, row);
  return (
    <FeedNoticeCard notice="communityWord" title={title} message={count(added, adds)}>
      {row !== undefined && (
        <Pressable
          testID="community-word-open"
          accessibilityRole="button"
          // The voices break a word at the Stress mark, so VoiceOver reads the card without it.
          accessibilityLabel={withoutStress(`${row.title}, ${subtitle ?? ''}`)}
          {...voice}
          onPress={onOpen}
          style={({ pressed }) => [
            styles.card,
            {
              backgroundColor: pressed ? colors.surfaceSunken : colors.surface,
              borderColor: colors.line,
              borderRadius: radii.card,
            },
          ]}
        >
          <Text style={[styles.title, { color: colors.ink, fontFamily: fontFamilies.word }]}>
            {row.title}
          </Text>
          <Text
            numberOfLines={2}
            style={[styles.subtitle, { color: colors.inkSecondary, fontFamily: fontFamilies.ui }]}
          >
            {subtitle}
          </Text>
        </Pressable>
      )}
    </FeedNoticeCard>
  );
}

const styles = StyleSheet.create({
  // The border is the card's only elevation, as on an Entry card.
  card: {
    alignSelf: 'stretch',
    marginTop: space[6],
    padding: space[6],
    gap: space[2],
    borderWidth: 1,
  },
  title: { fontSize: typeSize.subhead, fontWeight: '500', textAlign: 'center' },
  subtitle: {
    fontSize: typeSize.body,
    lineHeight: typeSize.body * 1.6,
    textAlign: 'center',
  },
});
