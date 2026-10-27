'use no memo';
// Reanimated or gesture code: the React Compiler skips this module (ADR 0059).

import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  PixelRatio,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { BottomSheet } from '../primitives/BottomSheet';
import { useEdition } from '../providers/EditionProvider';
import { PrimaryButton } from '../primitives/PrimaryButton';
import { SegmentedControl } from '../primitives/SegmentedControl';
import { SHARE_CARD, ShareCard, type ShareCardContent } from './ShareCard';
import { SheetTitle } from '../primitives/SheetParts';
import {
  lineHeight,
  type ShareCardFormat,
  shareImage,
  space,
  toastElevation,
  toastRadius,
  typeSize,
} from '../tokens';
import { useTokens } from '../providers/TokensProvider';

/** The share of the screen's height the preview may take, so the sheet fits the SE. */
const PREVIEW_HEIGHT_SHARE = 0.58;

/** How long the toast stays, as the undo toast does. */
const TOAST_MS = 4000;
/** The toast's fade in, as the undo toast's. */
const FADE_MS = 200;
/** The toast's message stops growing here, so it stays whole over the preview. */
const TOAST_MAX_FONT_SCALE = 1.3;

/** What sharing came to, as the shell reports it. */
export type ShareSheetOutcome = 'closed' | 'failed';

/**
 * The share sheet: the title, a live preview of the Share Card, the format
 * control (Story / Square), which switches the preview at once, and
 * «Поділитися», which hands the shell the card laid out off screen at the size
 * of its format's image (`shareImage`, in points at the screen's scale) to
 * capture and share. It opens in `initialFormat` and reports each format the
 * reader picks, so the shell can open it in the last one. Once the system share
 * sheet closes, shared or cancelled, the sheet closes too; when sharing fails,
 * a short toast says so and the sheet stays open to try again. A tap on the
 * scrim, a drag down or VoiceOver's escape closes it without sharing. Needs a
 * `SafeAreaProvider` above it.
 */
export function ShareSheet({
  visible,
  initialFormat,
  onFormatChange,
  onShare,
  onClose,
  ...card
}: ShareCardContent & {
  visible: boolean;
  /** The format the sheet opens in. */
  initialFormat: ShareCardFormat;
  onFormatChange: (format: ShareCardFormat) => void;
  /** Captures the card in the view, drawn in the format, and shares it; resolves once sharing is over. */
  onShare: (cardView: View, format: ShareCardFormat) => Promise<ShareSheetOutcome>;
  onClose: () => void;
}) {
  return (
    <BottomSheet visible={visible} onClose={onClose} testID="share-sheet">
      <ShareSheetContent
        card={card}
        initialFormat={initialFormat}
        onFormatChange={onFormatChange}
        onShare={onShare}
        onClose={onClose}
      />
    </BottomSheet>
  );
}

/** The sheet's content, mounted while it is open, so a toast never outlives it. */
function ShareSheetContent({
  card,
  initialFormat,
  onFormatChange,
  onShare,
  onClose,
}: {
  card: ShareCardContent;
  initialFormat: ShareCardFormat;
  onFormatChange: (format: ShareCardFormat) => void;
  onShare: (cardView: View, format: ShareCardFormat) => Promise<ShareSheetOutcome>;
  onClose: () => void;
}) {
  const { radii } = useTokens();
  const { strings } = useEdition();
  const { width, height } = useWindowDimensions();
  const captured = useRef<View>(null);
  const sharing = useRef(false);
  // Each failure shows a toast of its own.
  const [failures, setFailures] = useState(0);
  const [format, setFormat] = useState(initialFormat);
  const size = SHARE_CARD[format];
  const scale = Math.min(
    1,
    (width - 2 * space[5]) / size.width,
    (height * PREVIEW_HEIGHT_SHARE) / size.height,
  );

  async function share() {
    if (sharing.current || captured.current === null) return;
    sharing.current = true;
    const outcome = await onShare(captured.current, format);
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
              width: size.width * scale,
              height: size.height * scale,
              borderRadius: radii.chip,
            },
          ]}
        >
          <ShareCard {...card} format={format} width={size.width * scale} />
          {failures > 0 && <Toast key={failures} message={strings.share.captureFailed} />}
        </View>
      </ScrollView>
      {/* Under the preview, so it stays put under the thumb when the preview changes its height. */}
      <SegmentedControl
        accessibilityLabel={strings.share.format}
        segments={[
          { value: 'story', label: strings.share.story, testID: 'share-format-story' },
          { value: 'square', label: strings.share.square, testID: 'share-format-square' },
        ]}
        selected={format}
        onSelect={(chosen) => {
          setFormat(chosen);
          onFormatChange(chosen);
        }}
      />
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
        <ShareCard {...card} format={format} width={shareImage[format].width / PixelRatio.get()} />
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
  const opacity = useSharedValue(0);
  const [shown, setShown] = useState(true);

  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(message);
    // A fade is already the calm form Reduce Motion asks for, so it runs either way, as the undo toast's does.
    opacity.value = withTiming(1, { duration: FADE_MS, reduceMotion: ReduceMotion.Never });
    const timer = setTimeout(() => {
      setShown(false);
    }, TOAST_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [message, opacity]);
  const fadeStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  if (!shown) return null;
  return (
    <Animated.View
      testID="share-toast"
      style={[styles.toast, { backgroundColor: colors.ink }, fadeStyle]}
    >
      <Text
        {...voice}
        maxFontSizeMultiplier={TOAST_MAX_FONT_SCALE}
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
  offScreen: {
    position: 'absolute',
    top: 0,
    left: -Math.max(shareImage.story.width, shareImage.square.width),
  },
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
  toastMessage: { fontSize: typeSize.body, lineHeight: lineHeight.toast, fontWeight: '500' },
});
