import type { LearningEntry } from '@slovo/core';

import { EntryRow } from '../entries/EntryRow';
import { useEdition } from '../providers/EditionProvider';

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
 * A row of the «Вчу» list: the Entry with its meaning and its next Review day
 * on a chip on the right, today's in the accent colour. A tap opens the Entry; the list is the Core's own, so the row has
 * no action to rename, delete or take the Entry out.
 */
export function LearningRow({ entry, onPress }: { entry: LearningEntry; onPress: () => void }) {
  const reviewDayText = useReviewDayText();
  return (
    <EntryRow
      testID={`learning-row-${entry.entryId}`}
      row={entry.row}
      day={{
        label: reviewDayText(entry.daysUntilReview),
        today: entry.daysUntilReview <= 0,
      }}
      onPress={onPress}
    />
  );
}
