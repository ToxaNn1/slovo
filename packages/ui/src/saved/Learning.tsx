import type { LearningEntry } from '@slovo/core';

import { entryLabelBeside } from '../entries/entry-row-text';
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
 * A row of the «Вчу» list: the Entry with its kind and its next Review day on
 * the right. A tap opens the Entry; the list is the Core's own, so the row has
 * no action to rename, delete or take the Entry out.
 */
export function LearningRow({ entry, onPress }: { entry: LearningEntry; onPress: () => void }) {
  const { strings } = useEdition();
  const reviewDayText = useReviewDayText();
  return (
    <EntryRow
      testID={`learning-row-${entry.entryId}`}
      row={entry.row}
      trailing={entryLabelBeside(strings.history, entry.row, reviewDayText(entry.daysUntilReview))}
      onPress={onPress}
    />
  );
}
