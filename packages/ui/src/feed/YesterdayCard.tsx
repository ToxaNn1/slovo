import type { WordCardModel } from '@slovo/core';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { EntryCard } from '../entries/EntryCard';
import { useEdition } from '../providers/EditionProvider';
import { space } from '../tokens';
import { FeedNoticeCard } from './FeedNoticeCard';

/**
 * What Yesterday's Word carries: its «Знаю» and «Не знаю» buttons, or while marks are swiped the actions
 * in the card's top-right corner.
 */
export type YesterdaySlots =
  { slot: 'marks'; marks: ReactNode } | { slot: 'corner'; corner: ReactNode };

/**
 * Yesterday («Пам'ятаєш вчорашнє слово?»): the Feed Notice with the card of
 * the day before's Word of the Day in Self-check style, whatever the Self-check
 * setting. Until the reader reveals it, the card shows only its Lemma, part of
 * speech and Category, and the Knowledge Mark buttons in `marks` are inactive
 * (ADR 0054). While marks are swiped the card carries its `corner` instead.
 */
export function YesterdayCard({
  word,
  slots,
}: {
  word: WordCardModel;
  /** None while the Knowledge and Swipe Marks switches are both off. */
  slots?: YesterdaySlots | undefined;
}) {
  const { strings } = useEdition();
  return (
    <FeedNoticeCard notice="yesterday" title={strings.feedNotices.yesterday.title}>
      <View style={styles.word}>
        <EntryCard
          card={{ kind: 'word', entryId: word.wordId, model: word }}
          selfCheck
          slots={
            slots === undefined
              ? undefined
              : slots.slot === 'corner'
                ? { slot: 'corner', corner: slots.corner, swipe: undefined }
                : { slot: 'actions', actions: <View style={styles.marks}>{slots.marks}</View> }
          }
        />
      </View>
    </FeedNoticeCard>
  );
}

const styles = StyleSheet.create({
  word: { alignSelf: 'stretch', marginTop: space[6] },
  marks: { marginTop: space[3] },
});
