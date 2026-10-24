import type { LearningEntry } from '@slovo/core';

import { entryKindBeside } from '../entries/entry-row-text';
import { EntryRow } from '../entries/EntryRow';
import { fill, useEdition } from '../providers/EditionProvider';
import { SavedCard, SavedCardRows } from './SavedCard';

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
      trailing={entryKindBeside(strings.history, entry.row, reviewDayText(entry.daysUntilReview))}
      onPress={onPress}
    />
  );
}

/**
 * The «Вчу» card of the Saved tab: the count over the next Entries due for
 * Review with their days. A tap opens the list.
 */
export function LearningCard({
  entries,
  onPress,
}: {
  /** Every Entry of the list, the next Review first. */
  entries: readonly LearningEntry[];
  onPress: () => void;
}) {
  const { strings, count } = useEdition();
  const reviewDayText = useReviewDayText();
  const { learning } = strings;
  return (
    <SavedCard
      testID="saved-learning"
      title={learning.title}
      count={entries.length}
      accessibilityLabel={fill(learning.cardLabel, {
        count: count(learning.count, entries.length),
      })}
      onPress={onPress}
    >
      <SavedCardRows
        rows={entries.slice(0, NEXT_SHOWN).map(({ row, daysUntilReview }) => ({
          title: row.title,
          trailing: reviewDayText(daysUntilReview),
        }))}
      />
    </SavedCard>
  );
}
