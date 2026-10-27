import { buildWeeklyRecapShareCard, type LocalDate } from '@slovo/core';
import { ShareSheet, WeeklyRecapCard } from '@slovo/ui';
import { useState } from 'react';

import { edition, editionStrings } from '../edition/edition';
import { shareCardOnDevice } from '../share/device-share';
import { sessionShareFormat } from '../share/share-card';
import { useShown } from '../shown-in-effect';
import { useWeeklyRecap } from './weekly-recap';

/**
 * The Weekly Recap card of the local day `day`, with the numbers of its week,
 * without the Streak while it is not shown. «Поділитися» opens the share
 * sheet over the recap's Share Card, the same numbers in the format chosen
 * last this session; it is there only when the binary can capture the Share
 * Card and the Share Cards switch is on in effect. Sharing writes no user
 * state.
 */
export function WeeklyRecapNotice({ day }: { day: LocalDate }) {
  const recap = useWeeklyRecap(day);
  const shown = useShown();
  const hideStreak = shown.stats?.streak !== true;
  const share = shown.entryButtons.shareCard ? shareCardOnDevice : undefined;
  const [open, setOpen] = useState(false);
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
          recap={buildWeeklyRecapShareCard(recap, editionStrings.share.weeklyRecap, hideStreak)}
          watermark={edition.displayName}
          initialFormat={sessionShareFormat.format}
          onFormatChange={(format) => {
            sessionShareFormat.choose(format);
          }}
          onShare={(view, format) => share(view, 'weekly-recap', format)}
          onClose={() => {
            setOpen(false);
          }}
        />
      )}
    </>
  );
}
