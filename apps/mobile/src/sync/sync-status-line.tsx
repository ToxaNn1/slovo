import type { Sync } from '@slovo/core';
import { space, typeStyle, useTokens } from '@slovo/ui';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Polygon } from 'react-native-svg';

import { deviceClock } from '../device/device-clock';
import { editionStrings } from '../edition/edition';
import { useSubscribed, type Opening } from '../opening';
import { useShell } from '../shell-value';
import { useShown } from '../shown-in-effect';
import { syncStatusLine } from './sync-status';

/**
 * The status line under the email of the Account screen, as Sync stands, with
 * a red ✓ once the words are synced. The card around it is one element, so
 * VoiceOver reads the email and the line together. Nothing
 * while Sync opens, when the Edition has none or it is turned off remotely, or
 * before a first sync has gone through.
 */
export function SyncStatusLine() {
  const { sync } = useShell();
  if (!useShown().sync || sync === undefined) return null;
  return <Opened opening={sync} />;
}

function Opened({ opening }: { opening: Opening<Sync> }) {
  const opened = useSubscribed(opening, ({ state }) => state);
  return opened.status === 'ready' ? <Line sync={opened.value} /> : null;
}

function Line({ sync }: { sync: Sync }) {
  const state = useSubscribed(sync, ({ state }) => state);
  const tokens = useTokens();
  const line = syncStatusLine({
    state,
    strings: editionStrings.account.sync,
    months: editionStrings.dates.shortMonths,
    clock: deviceClock,
  });
  if (line === undefined) return null;
  const synced = !state.running && !state.offline;
  return (
    <View testID="account-sync-line" style={styles.line}>
      {synced && (
        <Svg testID="account-sync-check" width={13} height={11} viewBox="0 0 26 22">
          <Polygon points="0,12 4,8 10,14 22,0 26,4 10,22" fill={tokens.colors.accent} />
        </Svg>
      )}
      <Text style={[typeStyle('meta', tokens), { color: tokens.colors.muted }]}>{line}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  line: { flexDirection: 'row', alignItems: 'center', gap: space[1] },
});
