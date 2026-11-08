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
export const shapeOf = (badge: BadgeState) => familyOf(badge)?.shape ?? 'circle';

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
 * What a Badge's mark says under it and to VoiceOver: the day it was earned
 * («Отримано 13 жовтня»), how far its condition has come («1 з 3 днів»), or,
 * for a condition of one first time, «Ще не отримано».
 */
export function useBadgeStatus() {
  const { count } = useEdition();
  return {
    statusOf: (badge: BadgeState) => {
      if (badge.earned) return fill(strings.earned, { date: dayText(badge.date) });
      return progressOf(badge) ?? strings.notYet;
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
 * A tap on a Badge's mark, for the screens that show the Badges. With the
 * `badgeSheet` switch on, every tap opens the Badge's sheet (board 10
 * p3/p4) and opens the Badge, which ends its «НОВА» mark (ADR 0085), an
 * earned one with the shout. With it off, only an earned Badge answers,
 * stamped on red. Draw `opening` on the screen.
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

  const onPress = (badge: BadgeState) => {
    if (sheetShown) {
      setOpened({ kind: 'sheet', badge });
      setSheeted(badge);
      if (badge.earned) sounds.play('shout');
    } else {
      if (!badge.earned) return;
      setOpened({ kind: 'stamp', badge });
    }
    void badges.open(badge.id).catch(() => undefined);
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
          onClose={close}
        />
      )}
    </>
  );
  return { onPress, opening };
}
