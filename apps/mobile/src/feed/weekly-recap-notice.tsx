import { buildShareCardContent, type WeeklyRecapModel } from '@slovo/core';
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
import { useEditionInEffect } from '../edition/remote-switches';

/**
 * The Weekly Recap's Feed page (board f5): «Твій тиждень» on top, with the
 * numbers of its week, unless it is `folded`, and the day's Yesterday under it. «Готово» folds
 * the card away through `onFold`, and a toast offers «Повернути», which
 * brings it back through `onRestore`.
 */
export function WeeklyRecapPage({
  recap,
  folded,
  yesterday,
  onFold,
  onRestore,
}: {
  recap: WeeklyRecapModel;
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
          recap={recap}
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
 * The Weekly Recap card with the numbers of its week,
 * without the Streak while it is not shown, and without the week's XP and goal
 * days while the XP bar is not («Без лічильників»). Its Share icon opens the share
 * sheet over the recap's Share Card, the same numbers in the format chosen
 * last this session; it is there only when the binary can capture the Share
 * Card and the Share Cards switch is on in effect. Sharing writes no user
 * state.
 */
export function WeeklyRecapNotice({
  recap: model,
  onDone,
}: {
  recap: WeeklyRecapModel;
  /** «Готово»: folds the card away; without it, no «Готово». */
  onDone?: () => void;
}) {
  const shown = useShown();
  const inEffect = useEditionInEffect();
  const recap = withoutCounters(model, shown.xpBar);
  const hideStreak = shown.stats?.streak !== true;
  const { shareCard } = useShell();
  const share = inEffect.isFeatureEnabled('shareCards') ? shareCard : undefined;
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
      {share !== undefined && (
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
function withoutCounters(recap: WeeklyRecapModel, xpShown: boolean): WeeklyRecapModel {
  if (xpShown) return recap;
  const { xp: _xp, goalDays: _goalDays, ...rest } = recap;
  return rest;
}

const styles = StyleSheet.create({
  page: { flex: 1, gap: weeklyRecapPage.pageGap },
});
