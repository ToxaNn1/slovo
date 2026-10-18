import type { Sync } from '@slovo/core';
import { typeSize, useTokens } from '@slovo/ui';
import { Text } from 'react-native';

import { deviceClock } from '../device/device-clock';
import { editionStrings } from '../edition/edition';
import { useEditionInEffect } from '../edition/remote-switches';
import { useSubscribed, type Opening } from '../opening';
import { syncOpening } from './device-sync';
import { syncStatusLine } from './sync-status';

/**
 * The status line under the email of the SLOVO ID screen, as Sync stands. It
 * is part of the email's text, so VoiceOver reads the two together. Nothing
 * while Sync opens, when the Edition has none or it is turned off remotely, or
 * before a first sync has gone through.
 */
export function SyncStatusLine() {
  const on = useEditionInEffect().isFeatureEnabled('sync');
  if (!on || syncOpening === undefined) return null;
  return <Opened opening={syncOpening} />;
}

function Opened({ opening }: { opening: Opening<Sync> }) {
  const opened = useSubscribed(opening, ({ state }) => state);
  return opened.status === 'ready' ? <Line sync={opened.value} /> : null;
}

function Line({ sync }: { sync: Sync }) {
  const state = useSubscribed(sync, ({ state }) => state);
  const { colors, fontFamilies } = useTokens();
  const line = syncStatusLine({ state, strings: editionStrings.account.sync, clock: deviceClock });
  if (line === undefined) return null;
  return (
    <Text
      style={{
        color: colors.muted,
        fontFamily: fontFamilies.ui,
        fontSize: typeSize.caption,
        fontWeight: '400',
      }}
    >
      {`\n${line}`}
    </Text>
  );
}
