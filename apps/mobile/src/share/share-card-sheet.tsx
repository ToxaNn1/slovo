import { buildShareCardContent, type ShareCardKind, type ShareCardSubject } from '@slovo/core';
import { deviceClock } from '../device/device-clock';
import { ShareSheet } from '@slovo/ui';

import { useComposition } from '../composition';
import { edition, editionStrings } from '../edition/edition';
import type { ShareCard } from '../shell-value';
import { sessionShareFormat } from './share-card';

/**
 * The share sheet over the Share Card of `subject`, in the format chosen last
 * this session. A share the reader sends tells Analytics which `kind` of card
 * it was. Sharing writes no user state.
 */
export function ShareCardSheet({
  subject,
  kind,
  share,
  visible,
  onClose,
}: {
  subject: ShareCardSubject;
  kind: ShareCardKind;
  share: ShareCard;
  visible: boolean;
  onClose: () => void;
}) {
  const composition = useComposition();
  const content = buildShareCardContent(subject, editionStrings, edition.locale, deviceClock);
  const badge = 'badge' in subject ? subject.badge : undefined;
  const family =
    badge === undefined ? undefined : edition.badgeFamilies.find(({ id }) => id === badge.family);
  return (
    <ShareSheet
      visible={visible}
      content={content}
      watermark={edition.displayName}
      badge={
        badge === undefined
          ? undefined
          : {
              shape: family?.shape ?? 'circle',
              tone: family?.tone ?? 'ink',
              symbol: badge.symbol,
            }
      }
      initialFormat={sessionShareFormat.format}
      onFormatChange={(format) => {
        sessionShareFormat.choose(format);
      }}
      onShare={(view, format) =>
        share(view, content.shows.replaceAll(':', '-'), format, () => {
          void composition.analytics.shareCardShared(kind);
        })
      }
      onClose={onClose}
    />
  );
}
