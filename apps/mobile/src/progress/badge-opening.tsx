import type { BadgeState } from '@slovo/core';
import { BadgeSheet, BadgeStamp, fill, useEdition, useInterfaceSounds } from '@slovo/ui';
import { useState, type ReactNode } from 'react';

import { useComposition } from '../composition';
import { edition, editionStrings } from '../edition/edition';
import { useEditionInEffect } from '../edition/remote-switches';
import { MascotAs } from '../mascot/mascot';
import { dayText } from './day-text';

const strings = editionStrings.settings.badges;

/** The family of a Badge. */
const familyOf = ({ family }: BadgeState) => edition.badgeFamilies.find(({ id }) => id === family);

/** The shape of a Badge's family. */
const shapeOf = (badge: BadgeState) => familyOf(badge)?.shape ?? 'circle';

/** What a Badge's condition asks, in the Edition's short words. */
export const conditionOf = ({ id }: BadgeState) =>
  edition.badges.find((badge) => badge.id === id)?.conditionText ?? '';

/** The progress forms of an unearned Badge's condition; none for a condition of one first time. */
function progressForms({ condition }: BadgeState) {
  switch (condition.kind) {
    case 'streak':
    case 'dailyCrosswordRun':
      return strings.progress.days;
    case 'confirmedEntries':
      return strings.progress.entries;
    case 'rightAnswers':
    case 'rightRun':
      return strings.progress.rightAnswers;
    case 'level':
      return strings.progress.level;
    case 'gameWin':
    case 'rightOnRarity':
    case 'flawlessGame':
      return undefined;
  }
}

/**
 * What a Badge's card says under its mark and to VoiceOver:
 * «Отримано», or while not earned how far its condition has come, rounded
 * down so it never reads the whole («Ще ні · 77%»); and the sheet's line,
 * which keeps the date («Отримано 13 жовтня») and the exact progress
 * («Ще ні · 23 з 30 днів», or «Ще не отримано» for a condition of one first
 * time).
 */
export function useBadgeStatus() {
  const { count } = useEdition();
  return {
    statusOf: (badge: BadgeState) => {
      if (badge.earned) return strings.cardEarned;
      const { current, target } = badge.progress;
      const percent = Math.floor((100 * Math.min(current, target)) / target);
      return fill(strings.cardNotYet, { percent: String(percent) });
    },
    /** The sheet's line: the date, or «Ще ні · 1 з 3 днів» while not earned. */
    sheetStatusOf: (badge: BadgeState) => {
      if (badge.earned) return fill(strings.earned, { date: dayText(badge.date) });
      const progress = progressOf(badge);
      return progress === undefined ? strings.notYet : fill(strings.sheet.notYet, { progress });
    },
  };

  function progressOf(badge: BadgeState & { earned: false }) {
    const forms = progressForms(badge);
    if (forms === undefined) return undefined;
    const { current, target } = badge.progress;
    return fill(count(forms, target), { current: String(current) });
  }
}

/** What a screen of Badges opens at a tap: the sheet, or the stamp of an earned one. */
type Opened =
  | { readonly kind: 'sheet'; readonly badge: BadgeState }
  | { readonly kind: 'stamp'; readonly badge: BadgeState & { earned: true } };

/**
 * A tap on a Badge's mark, for the screens that show the Badges (decision 5). An earned Badge with no `badge-opened` record yet is stamped on
 * red with the shout, and taking the stamp writes that record, which ends its
 * «НОВА» mark on every device. Every other Badge opens its sheet
 * (`XSaved` p3/p4) behind the `badgeSheet` switch; with it off, only an
 * earned Badge answers, stamped. Draw `opening` on the screen.
 */
export function useBadgeOpening(): {
  onPress: (badge: BadgeState) => void;
  opening: ReactNode;
} {
  const badges = useComposition().badges;
  const sounds = useInterfaceSounds();
  const sheetShown = useEditionInEffect().isFeatureEnabled('badgeSheet');
  const { sheetStatusOf } = useBadgeStatus();
  const [opened, setOpened] = useState<Opened | undefined>(undefined);
  /** The Badge of the sheet, kept while the sheet slides away. */
  const [sheeted, setSheeted] = useState<BadgeState | undefined>(undefined);
  const close = () => {
    setOpened(undefined);
  };
  const take = (badge: BadgeState) => {
    close();
    void badges.open(badge.id).catch(() => undefined);
  };

  const onPress = (badge: BadgeState) => {
    if (badge.earned && (badge.isNew || !sheetShown)) {
      setOpened({ kind: 'stamp', badge });
      if (badge.isNew) sounds.play('shout');
    } else if (sheetShown) {
      setOpened({ kind: 'sheet', badge });
      setSheeted(badge);
    }
  };

  const family = sheeted === undefined ? undefined : familyOf(sheeted);
  const stamp = editionStrings.settings.profile.badgeStamp;
  const opening = (
    <>
      <BadgeSheet
        visible={opened?.kind === 'sheet'}
        badge={
          sheeted === undefined
            ? undefined
            : {
                ...sheeted,
                shape: family?.shape ?? 'circle',
                tone: family?.tone ?? 'ink',
                condition: conditionOf(sheeted),
                status: sheetStatusOf(sheeted),
              }
        }
        kicker={strings.sheet.kicker}
        doneLabel={strings.sheet.done}
        onClose={close}
      />
      {opened?.kind === 'stamp' && (
        <BadgeStamp
          shape={shapeOf(opened.badge)}
          symbol={opened.badge.symbol}
          name={opened.badge.name}
          kicker={stamp.kicker}
          line={stamp.line}
          ribbon={stamp.ribbon}
          doneLabel={stamp.done}
          mascot={<MascotAs state="celebrates" onRed />}
          isNew={opened.badge.isNew}
          onClose={() => {
            take(opened.badge);
          }}
        />
      )}
    </>
  );
  return { onPress, opening };
}
