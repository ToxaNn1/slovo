import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  PixelRatio,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { BottomSheet } from './BottomSheet';
import { useEdition } from './EditionProvider';
import { PrimaryButton } from './PrimaryButton';
import { ShareCard, STORY_CARD, type ShareCardContent } from './ShareCard';
import { SheetTitle } from './SheetParts';
import { space, storyImage, toastElevation, toastRadius, typeSize } from './tokens';
import { useTokens } from './TokensProvider';

/** The share of the screen's height the preview may take, so the sheet fits the SE. */
const PREVIEW_HEIGHT_SHARE = 0.58;

/** How long the toast stays, as the undo toast does. */
const TOAST_MS = 4000;
/** The toast's fade in, as the undo toast's. */
const FADE_MS = 200;

/** What sharing came to, as the shell reports it. */
export type ShareSheetOutcome = 'closed' | 'failed';

/**
 * The share sheet: the title, a live preview of the Story Share Card, and
 * «Поділитися», which hands the shell the card laid out off screen at the
 * size of its image (`storyImage`, in points at the screen's scale) to
 * capture and share. Once the system share sheet closes, shared
 * or cancelled, the sheet closes too; when sharing fails, a short toast says
 * so and the sheet stays open to try again. A tap on the scrim, a drag down
 * or VoiceOver's escape closes it without sharing. Needs a
 * `SafeAreaProvider` above it.
 */
export function ShareSheet({
  visible,
  onShare,
  onClose,
  ...card
}: ShareCardContent & {
  visible: boolean;
  /** Captures the card in the view and shares it; resolves once sharing is over. */
  onShare: (cardView: View) => Promise<ShareSheetOutcome>;
  onClose: () => void;
}) {
  return (
    <BottomSheet visible={visible} onClose={onClose} testID="share-sheet">
      <ShareSheetContent card={card} onShare={onShare} onClose={onClose} />
    </BottomSheet>
  );
}

/** The sheet's content, mounted while it is open, so a toast never outlives it. */
function ShareSheetContent({
  card,
  onShare,
  onClose,
}: {
  card: ShareCardContent;
  onShare: (cardView: View) => Promise<ShareSheetOutcome>;
  onClose: () => void;
}) {
  const { radii } = useTokens();
  const { strings } = useEdition();
  const { width, height } = useWindowDimensions();
  const captured = useRef<View>(null);
  const sharing = useRef(false);
  // Each failure shows a toast of its own.
  const [failures, setFailures] = useState(0);
  const scale = Math.min(
    1,
    (width - 2 * space[5]) / STORY_CARD.width,
    (height * PREVIEW_HEIGHT_SHARE) / STORY_CARD.height,
  );

  async function share() {
    if (sharing.current || captured.current === null) return;
    sharing.current = true;
    const outcome = await onShare(captured.current);
    sharing.current = false;
    if (outcome === 'failed') setFailures((count) => count + 1);
    else onClose();
  }

  return (
    <>
      <ScrollView bounces={false} style={styles.scroll} contentContainerStyle={styles.content}>
        <SheetTitle>{strings.share.title}</SheetTitle>
        <View
          testID="share-preview"
          style={[
            styles.preview,
            {
              width: STORY_CARD.width * scale,
              height: STORY_CARD.height * scale,
              borderRadius: radii.chip,
            },
          ]}
        >
          <ShareCard {...card} width={STORY_CARD.width * scale} />
          {failures > 0 && <Toast key={failures} message={strings.share.captureFailed} />}
        </View>
      </ScrollView>
      <PrimaryButton
        testID="share-sheet-share"
        label={strings.share.share}
        onPress={() => {
          void share();
        }}
      />
      {/* The card the image is drawn from: at the image's size, off screen, out of VoiceOver's way. */}
      <View
        ref={captured}
        collapsable={false}
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={styles.offScreen}
      >
        <ShareCard {...card} width={storyImage.width / PixelRatio.get()} />
      </View>
    </>
  );
}

/**
 * A toast with a message alone, drawn like the undo toast, over the bottom of
 * the preview, for 4 s. VoiceOver announces it.
 */
function Toast({ message }: { message: string }) {
  const { colors, fontFamilies } = useTokens();
  const { voice } = useEdition();
  const opacity = useRef(new Animated.Value(0)).current;
  const [shown, setShown] = useState(true);

  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(message);
    Animated.timing(opacity, { toValue: 1, duration: FADE_MS, useNativeDriver: true }).start();
    const timer = setTimeout(() => {
      setShown(false);
    }, TOAST_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [message, opacity]);

  if (!shown) return null;
  return (
    <Animated.View
      testID="share-toast"
      style={[styles.toast, { opacity, backgroundColor: colors.ink }]}
    >
      <Text
        {...voice}
        style={[styles.toastMessage, { color: colors.background, fontFamily: fontFamilies.ui }]}
      >
        {message}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // Shrinks to scroll when the largest text sizes leave too little room.
  scroll: { flexGrow: 0, flexShrink: 1 },
  content: { gap: space[4], paddingBottom: space[4] },
  preview: { alignSelf: 'center', overflow: 'hidden' },
  // Left of the screen: the card is never wider than its image in pixels.
  offScreen: { position: 'absolute', top: 0, left: -storyImage.width },
  toast: {
    position: 'absolute',
    left: space[3],
    right: space[3],
    bottom: space[3],
    borderRadius: toastRadius,
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    ...toastElevation,
  },
  toastMessage: { fontSize: typeSize.body, lineHeight: 21, fontWeight: '500' },
});
