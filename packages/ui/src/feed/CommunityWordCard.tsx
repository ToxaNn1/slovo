import { withoutStress, type EntryRowModel } from '@slovo/core';
import { Pressable, StyleSheet, Text } from 'react-native';

import { entryRowSubtitle } from '../entries/entry-row-text';
import { useEdition } from '../providers/EditionProvider';
import { useTokens } from '../providers/TokensProvider';
import { noticeCard, typeStyle } from '../tokens';
import { FeedNoticeCard } from './FeedNoticeCard';

/**
 * The Community Word («Слово тижня спільноти», ADR 0060): the Feed Notice
 * named by its eyebrow, with how many readers added the Entry to Favorites
 * last week, «додали 12 читачів» in the Edition's plural forms, and the mini
 * card of the Entry, its title large over its second line as its row says
 * them. A tap on the mini card opens the Entry. Until the Entry's row is read, there is no mini card.
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
  const tokens = useTokens();
  const { colors, radii } = tokens;
  const { title, added } = strings.feedNotices.communityWord;
  const subtitle = row === undefined ? undefined : entryRowSubtitle(strings.correctionCard, row);
  return (
    <FeedNoticeCard
      notice="communityWord"
      titleKind="eyebrow"
      title={title}
      message={count(added, adds)}
    >
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
              backgroundColor: pressed ? colors.surfaceSunken : undefined,
              borderRadius: radii.tile,
            },
          ]}
        >
          <Text style={[typeStyle('communityWord', tokens), { color: colors.ink }]}>
            {row.title}
          </Text>
          <Text
            numberOfLines={2}
            style={[typeStyle('communityDefinition', tokens), { color: colors.ink }]}
          >
            {subtitle}
          </Text>
        </Pressable>
      )}
    </FeedNoticeCard>
  );
}

const styles = StyleSheet.create({
  card: { alignSelf: 'stretch', gap: noticeCard.wordGap },
});
