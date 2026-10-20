import type { EntryRowModel } from '@slovo/core';

import { EntryRow } from '../entries/EntryRow';
import { fill, useEdition } from '../providers/EditionProvider';
import { SavedCard, SavedCardRows } from './SavedCard';

/** An Entry of the «Вчу» list: its row and how many local days until its next Review. */
export interface LearningItem {
  readonly row: EntryRowModel;
  /** 0 or less while it is due, 1 for tomorrow, and so on. */
  readonly daysUntilReview: number;
}

/** How many of the next Entries the «Вчу» card shows. */
const NEXT_SHOWN = 3;

/** When the Entry is next due for Review, in the Edition's words: «сьогодні», «завтра», «через 3 дні». */
function useReviewDayText(): (daysUntilReview: number) => string {
  const { strings, count } = useEdition();
  const { reviewDay } = strings.learning;
  return (days) => {
    if (days <= 0) return reviewDay.today;
    if (days === 1) return reviewDay.tomorrow;
    return count(reviewDay.inDays, days);
  };
}

/**
 * A row of the «Вчу» list: the Entry with its next Review day on the right. A
 * tap opens the Entry; the list is the Core's own, so the row has no action to
 * rename, delete or take the Entry out.
 */
export function LearningRow({ item, onPress }: { item: LearningItem; onPress: () => void }) {
  const reviewDayText = useReviewDayText();
  return (
    <EntryRow
      testID={`learning-row-${item.row.entryId}`}
      row={item.row}
      trailing={reviewDayText(item.daysUntilReview)}
      onPress={onPress}
    />
  );
}

/**
 * The «Вчу» card of the Saved tab: the count over the next Entries due for
 * Review with their days. A tap opens the list.
 */
export function LearningCard({
  items,
  onPress,
}: {
  /** Every Entry of the list, the next Review first. */
  items: readonly LearningItem[];
  onPress: () => void;
}) {
  const { strings, count } = useEdition();
  const reviewDayText = useReviewDayText();
  const { learning } = strings;
  return (
    <SavedCard
      testID="saved-learning"
      title={learning.title}
      count={items.length}
      accessibilityLabel={fill(learning.cardLabel, { count: count(learning.count, items.length) })}
      onPress={onPress}
    >
      <SavedCardRows
        rows={items.slice(0, NEXT_SHOWN).map(({ row, daysUntilReview }) => ({
          title: row.title,
          trailing: reviewDayText(daysUntilReview),
        }))}
      />
    </SavedCard>
  );
}
