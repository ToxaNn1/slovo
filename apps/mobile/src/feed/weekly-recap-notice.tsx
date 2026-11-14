import { buildShareCardContent, type LocalDate, type WeeklyRecapModel } from '@slovo/core';
import { deviceClock } from '../device/device-clock';
import { ShareSheet, UnderWeeklyRecap, useUndoToast, WeeklyRecapCard } from '@slovo/ui';
import { weeklyRecapPage } from '@slovo/ui/tokens';
import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { useComposition } from '../composition';
import { edition, editionStrings } from '../edition/edition';
import { useShell } from '../shell-value';
import { sessionShareFormat } from '../share/share-card';
import { useShown } from '../shown-in-effect';
import { useWeeklyRecap } from './weekly-recap';

/**
 * The Weekly Recap's Feed page (board f5, ADR 0130): «Твій тиждень» on top,
 * unless it is `folded`, and the day's Yesterday under it. «Готово» folds
 * the card away through `onFold`, and a toast offers «Повернути», which
 * brings it back through `onRestore`.
 */
export function WeeklyRecapPage({
  day,
  folded,
  yesterday,
  onFold,
  onRestore,
}: {
  day: LocalDate;
  folded: boolean;
  /** The Yesterday drawn under the week, if the page has one. */
  yesterday: ReactNode;
  onFold: () => void;
  onRestore: () => void;
}) {
  const showToast = useUndoToast();
  const words = editionStrings.feedNotices.weeklyRecap;
  return (
    <View style={styles.page}>
      {!folded && (
        <WeeklyRecapNotice
          day={day}
          onDone={() => {
            onFold();
            showToast({ message: words.folded, undoLabel: words.restore, onUndo: onRestore });
          }}
        />
      )}
      {yesterday !== undefined && <UnderWeeklyRecap folded={folded}>{yesterday}</UnderWeeklyRecap>}
    </View>
  );
}

/**
 * The Weekly Recap card of the local day `day`, with the numbers of its week,
 * without the Streak while it is not shown, and without the week's XP and goal
 * days while the XP bar is not («Без лічильників»). Its Share icon opens the share
 * sheet over the recap's Share Card, the same numbers in the format chosen
 * last this session; it is there only when the binary can capture the Share
 * Card and the Share Cards switch is on in effect. Sharing writes no user
 * state.
 */
export function WeeklyRecapNotice({
  day,
  onDone,
}: {
  day: LocalDate;
  /** «Готово»: folds the card away; without it, no «Готово». */
  onDone?: () => void;
}) {
  const shown = useShown();
  const recap = withoutCounters(useWeeklyRecap(day), shown.xpBar);
  const hideStreak = shown.stats?.streak !== true;
  const { shareCard } = useShell();
  const share = shown.entryButtons.shareCard ? shareCard : undefined;
  const [open, setOpen] = useState(false);
  const composition = useComposition();
  return (
    <>
      <WeeklyRecapCard
        recap={recap}
        hideStreak={hideStreak}
        onDone={onDone}
        onShare={
          share === undefined
            ? undefined
            : () => {
                setOpen(true);
              }
        }
      />
      {recap !== undefined && share !== undefined && (
        <ShareSheet
          visible={open}
          content={buildShareCardContent(
            { recap, hideStreak },
            editionStrings,
            edition.locale,
            deviceClock,
          )}
          watermark={edition.displayName}
          initialFormat={sessionShareFormat.format}
          onFormatChange={(format) => {
            sessionShareFormat.choose(format);
          }}
          onShare={(view, format) =>
            share(view, 'weekly-recap', format, () => {
              void composition.analytics.shareCardShared('weeklyRecap');
            })
          }
          onClose={() => {
            setOpen(false);
          }}
        />
      )}
    </>
  );
}

/** The recap without its XP and goal days while the XP bar is not shown. */
function withoutCounters(
  recap: WeeklyRecapModel | undefined,
  xpShown: boolean,
): WeeklyRecapModel | undefined {
  if (recap === undefined || xpShown) return recap;
  const { xp: _xp, goalDays: _goalDays, ...rest } = recap;
  return rest;
}

const styles = StyleSheet.create({
  page: { gap: weeklyRecapPage.pageGap },
});
