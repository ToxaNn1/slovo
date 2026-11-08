import { forceUpdateOf, type ForceUpdate, type ForceUpdateFacts } from '@slovo/core';
import { FeedError, minTouchTarget, space, typeStyle, useEdition, useTokens } from '@slovo/ui';
import { useEffect, useState, type ReactNode } from 'react';
import { BackHandler, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { editionStrings } from '../edition/edition';
import { Opened } from '../opened';
import { useOpened, useSubscribed } from '../opening';
import { useShell } from '../shell-value';
import { openStore } from './store-link';

/**
 * What the force-update minimums of the kept switches answer ask of this
 * device while the `forceUpdate` Feature Switch is in effect. It reads again
 * when a new answer changes them.
 */
export function useForceUpdate(device: ForceUpdateFacts): ForceUpdate {
  return useSubscribed(useOpened(useShell().remoteSwitches), ({ edition, minimums }) =>
    edition.isFeatureEnabled('forceUpdate') ? forceUpdateOf(minimums, device) : 'none',
  );
}

/**
 * The gate of the force update (ADR 0089), over the remote switches alone:
 * below the hard minimum the blocking screen draws instead of `children`, so
 * no screen under it mounts, even when the Language Pack fails to open; below
 * the soft minimum the banner draws over them until the reader closes it for
 * this app run. The Language Pack opens over the remote switches, so their
 * failure is its failure.
 */
export function ForceUpdateGate({
  device,
  children,
}: {
  device: ForceUpdateFacts;
  children: ReactNode;
}) {
  return (
    <Opened opening={useShell().remoteSwitches} failedTestID="language-pack-failed">
      <ForceUpdateInEffect device={device}>{children}</ForceUpdateInEffect>
    </Opened>
  );
}

function ForceUpdateInEffect({
  device,
  children,
}: {
  device: ForceUpdateFacts;
  children: ReactNode;
}) {
  const forceUpdate = useForceUpdate(device);
  // Above every reopening gate, so a closed banner stays closed until the next launch.
  const [dismissed, setDismissed] = useState(false);
  if (forceUpdate === 'blocking') return <BlockingScreen device={device} />;
  return (
    <>
      {children}
      {forceUpdate === 'banner' && !dismissed && (
        <Banner
          onUpdate={() => {
            openStore(device.platform);
          }}
          onDismiss={() => {
            setDismissed(true);
          }}
        />
      )}
    </>
  );
}

/** The blocking screen: no close, and Android's back button does nothing. */
function BlockingScreen({ device }: { device: ForceUpdateFacts }) {
  const { colors } = useTokens();
  const { title, body, button } = editionStrings.forceUpdate;
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => {
      subscription.remove();
    };
  }, []);
  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <FeedError
        title={title}
        message={body}
        retry={button}
        onRetry={() => {
          openStore(device.platform);
        }}
        testID="force-update-blocking"
      />
    </View>
  );
}

function Banner({ onUpdate, onDismiss }: { onUpdate: () => void; onDismiss: () => void }) {
  const tokens = useTokens();
  const { colors, radii } = tokens;
  const { voice } = useEdition();
  const { top } = useSafeAreaInsets();
  const { banner, bannerAction, dismiss } = editionStrings.forceUpdate;
  return (
    <View
      testID="force-update-banner"
      accessibilityRole="alert"
      style={[
        styles.banner,
        { top: top + space[2], backgroundColor: colors.ink, borderRadius: radii.button },
      ]}
    >
      <Text
        style={[typeStyle('sub', tokens), styles.line, { color: colors.background }]}
        {...voice}
      >
        {banner}
      </Text>
      <Pressable
        testID="force-update-store"
        accessibilityRole="link"
        accessibilityLabel={bannerAction}
        {...voice}
        onPress={onUpdate}
        style={styles.action}
      >
        <Text style={[typeStyle('buttonLabel', tokens), { color: colors.background }]}>
          {bannerAction}
        </Text>
      </Pressable>
      <Pressable
        testID="force-update-dismiss"
        accessibilityRole="button"
        accessibilityLabel={dismiss}
        {...voice}
        onPress={onDismiss}
        style={styles.action}
      >
        <Text style={[typeStyle('buttonLabel', tokens), { color: colors.background }]}>×</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  banner: {
    position: 'absolute',
    left: space[4],
    right: space[4],
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    paddingLeft: space[4],
  },
  line: { flex: 1, paddingVertical: space[3] },
  action: {
    minHeight: minTouchTarget,
    minWidth: minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space[2],
  },
});
