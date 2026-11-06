import type { BadgeShape, BadgeTone } from '@slovo/contracts';
import { useEffect } from 'react';
import { AccessibilityInfo, StyleSheet, Text, View } from 'react-native';

import { BottomSheet } from '../primitives/BottomSheet';
import { Button } from '../primitives/Button';
import { ToastFace } from '../primitives/UndoToast';
import { useEdition } from '../providers/EditionProvider';
import { useTokens } from '../providers/TokensProvider';
import { badgeSheet, typeStyle } from '../tokens';
import { markStateOf, type BadgeGridItem } from './BadgeGrid';
import { BadgeMark } from './BadgeMark';

/** What the sheet shows of one Badge: what the grid shows, in its family's shape and tone. */
export type BadgeSheetBadge = BadgeGridItem & {
  readonly shape: BadgeShape;
  readonly tone: BadgeTone;
  /** Its date once earned, how far its condition has come while not. */
  readonly status: string;
  /** A toast over the sheet, such as the one at a tap on a Badge not yet earned. */
  readonly toast?: string | undefined;
};

/**
 * One Badge in a bottom sheet with the slanted top (board 10 p3/p4): the
 * `kicker`, its mark large, its name, its status, and while it is not
 * earned a slanted bar of how far its condition has come, over the
 * `doneLabel` button, while `visible`; keep `badge` while it slides away.
 */
export function BadgeSheet({
  visible,
  badge,
  kicker,
  doneLabel,
  onClose,
}: {
  visible: boolean;
  badge: BadgeSheetBadge | undefined;
  kicker: string;
  doneLabel: string;
  onClose: () => void;
}) {
  const toast = visible ? badge?.toast : undefined;
  useEffect(() => {
    if (toast !== undefined) AccessibilityInfo.announceForAccessibility(toast);
  }, [toast]);

  return (
    <BottomSheet visible={visible && badge !== undefined} onClose={onClose} testID="badge-sheet">
      {badge !== undefined && (
        <BadgeSheetContent badge={badge} kicker={kicker} doneLabel={doneLabel} onClose={onClose} />
      )}
    </BottomSheet>
  );
}

function BadgeSheetContent({
  badge,
  kicker,
  doneLabel,
  onClose,
}: {
  badge: BadgeSheetBadge;
  kicker: string;
  doneLabel: string;
  onClose: () => void;
}) {
  const tokens = useTokens();
  const { colors } = tokens;
  const { voice } = useEdition();
  const state = markStateOf(badge);
  const fraction = state.kind === 'progress' ? state.fraction : 0;

  return (
    <View style={styles.content}>
      {badge.toast !== undefined && (
        <View style={styles.toast} pointerEvents="none">
          <ToastFace message={badge.toast} />
        </View>
      )}
      <Text {...voice} style={[typeStyle('soonTag', tokens), { color: colors.accent }]}>
        {kicker}
      </Text>
      <View style={styles.mark}>
        <BadgeMark
          shape={badge.shape}
          tone={badge.tone}
          symbol={badge.symbol}
          state={state}
          size={badgeSheet.markSide}
          testID="badge-sheet-mark"
        />
      </View>
      <Text
        {...voice}
        accessibilityRole="header"
        style={[typeStyle('stampName', tokens), styles.name, { color: colors.ink }]}
      >
        {badge.name}
      </Text>
      <Text
        {...voice}
        testID="badge-sheet-status"
        style={[typeStyle('meta', tokens), styles.status, { color: colors.muted }]}
      >
        {badge.status}
      </Text>
      {state.kind !== 'earned' && (
        <View
          testID="badge-sheet-bar"
          accessible={false}
          style={[styles.bar, { backgroundColor: colors.silhouette }]}
        >
          <View style={{ flex: fraction, backgroundColor: colors.accent }} />
          <View style={{ flex: 1 - fraction }} />
        </View>
      )}
      <View style={styles.done}>
        <Button testID="badge-sheet-done" label={doneLabel} onPress={onClose} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { alignItems: 'center' },
  toast: {
    position: 'absolute',
    bottom: '100%',
    left: 0,
    right: 0,
    marginBottom: badgeSheet.toastGap,
    alignItems: 'center',
  },
  mark: { marginTop: badgeSheet.markTop },
  name: { marginTop: badgeSheet.nameTop, textAlign: 'center' },
  status: { marginTop: badgeSheet.statusTop, textAlign: 'center' },
  bar: {
    alignSelf: 'stretch',
    marginTop: badgeSheet.barTop,
    height: badgeSheet.barHeight,
    flexDirection: 'row',
    overflow: 'hidden',
    transform: [{ skewX: `${String(badgeSheet.barSkew)}deg` }],
  },
  done: { alignSelf: 'stretch', marginTop: badgeSheet.doneTop },
});
