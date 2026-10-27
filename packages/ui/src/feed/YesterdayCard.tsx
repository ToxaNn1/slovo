import type { WordCardModel } from '@slovo/core';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { EntryCard } from '../entries/EntryCard';
import { useEdition } from '../providers/EditionProvider';
import { space } from '../tokens';
import { FeedNoticeCard } from './FeedNoticeCard';

/**
 * Yesterday («Пам'ятаєте вчорашнє слово?»): the Feed Notice with the card of
 * the day before's Word of the Day in Self-check style, whatever the Self-check
 * setting. Until the reader reveals it, the card shows only its Lemma, part of
 * speech and Category, and the Knowledge Mark buttons in `marks` are inactive
 * (ADR 0054).
 */
export function YesterdayCard({
  word,
  marks,
}: {
  word: WordCardModel;
  /** The «Знаю» and «Не знаю» buttons of the Word, if the Knowledge switch is on. */
  marks?: ReactNode;
}) {
  const { strings } = useEdition();
  return (
    <FeedNoticeCard notice="yesterday" title={strings.feedNotices.yesterday.title}>
      <View style={styles.word}>
        <EntryCard
          card={{ kind: 'word', entryId: word.wordId, model: word }}
          selfCheck
          actions={marks === undefined ? undefined : <View style={styles.marks}>{marks}</View>}
        />
      </View>
    </FeedNoticeCard>
  );
}

const styles = StyleSheet.create({
  word: { alignSelf: 'stretch', marginTop: space[6] },
  marks: { marginTop: space[3] },
});
