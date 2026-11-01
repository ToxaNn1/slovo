import { buildShareCardContent, type LocalDate, type WeeklyRecapModel } from '@slovo/core';
import { ShareSheet, WeeklyRecapCard } from '@slovo/ui';
import { useState } from 'react';

import { useComposition } from '../composition';
import { edition, editionStrings } from '../edition/edition';
import { useShell } from '../shell-value';
import { sessionShareFormat } from '../share/share-card';
import { useShown } from '../shown-in-effect';
import { useWeeklyRecap } from './weekly-recap';

/**
 * The Weekly Recap card of the local day `day`, with the numbers of its week,
 * without the Streak while it is not shown, and without the week's XP and goal
 * days while the XP bar is not («Без лічильників»). «Поділитися» opens the share
 * sheet over the recap's Share Card, the same numbers in the format chosen
 * last this session; it is there only when the binary can capture the Share
 * Card and the Share Cards switch is on in effect. Sharing writes no user
 * state.
 */
export function WeeklyRecapNotice({ day }: { day: LocalDate }) {
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
          content={buildShareCardContent({ recap, hideStreak }, editionStrings, edition.locale)}
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
