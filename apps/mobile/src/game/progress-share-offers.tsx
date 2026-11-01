import { buildShareCardContent, type ProgressShareCard } from '@slovo/core';
import { deviceClock } from '../device/device-clock';
import { SecondaryButton } from '@slovo/ui';
import { useState } from 'react';

import { useComposition } from '../composition';
import { edition, editionStrings } from '../edition/edition';
import { useSubscribed } from '../opening';
import { ShareCardSheet } from '../share/share-card-sheet';
import { useShell } from '../shell-value';
import { useShown } from '../shown-in-effect';

/** Which Share Card a progress card is, as Analytics names it. */
const kindOf = (card: ProgressShareCard) =>
  'level' in card ? 'level' : 'badge' in card ? 'badge' : 'streak';

/**
 * The progress Share Cards on offer today, a Level reached, a Badge earned
 * and a Streak milestone, each a button that opens its share sheet. Nothing
 * while the progress Share Cards are off in effect or the binary can't
 * capture a Share Card.
 */
export function ProgressShareOffers() {
  const cards = useSubscribed(useComposition().progressShareCards, (source) => source.state);
  const { shareCard } = useShell();
  const share = useShown().progressShareCards ? shareCard : undefined;
  const [open, setOpen] = useState<ProgressShareCard>();
  if (share === undefined) return null;
  return (
    <>
      {cards.map((card) => {
        const { body } = buildShareCardContent(card, editionStrings, edition.locale, deviceClock);
        const kind = kindOf(card);
        return body.kind === 'milestone' ? (
          <SecondaryButton
            key={`${kind}:${'badge' in card ? card.badge.id : ''}`}
            testID={`progress-share-${kind}`}
            label={`${body.title} · ${body.headline}`}
            onPress={() => {
              setOpen(card);
            }}
          />
        ) : null;
      })}
      {open !== undefined && (
        <ShareCardSheet
          subject={open}
          kind={kindOf(open)}
          share={share}
          visible
          onClose={() => {
            setOpen(undefined);
          }}
        />
      )}
    </>
  );
}
