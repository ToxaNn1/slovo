import { useEffect } from 'react';
import {
  AccessibilityInfo,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';

import type { EditionStrings } from '@slovo/contracts';

import { fill, useEdition } from '../providers/EditionProvider';
import {
  disabledOpacity,
  minTouchTarget,
  space,
  toastElevation,
  toastRadius,
  typeStyle,
  voiceMessage,
  withAlpha,
} from '../tokens';
import { useSchemeColors, useTokens } from '../providers/TokensProvider';
import { useOnAccent } from './on-accent';

/**
 * What the button shows: ready, the Lemma being spoken, or disabled because
 * the Word has no Recording in the chosen Narrator Voice (ADR 0195); a tap on
 * it still opens the message that says why.
 */
export type PronunciationButtonState = 'idle' | 'playing' | 'unavailable';

/**
 * Why a tap read nothing, shown in a small message under the button: the
 * device has no voice for the Edition's language, the Word has Recordings
 * but none in the chosen Narrator Voice (its name in `voice`), it has none at
 * all, or its Recording is not cached and the device is offline.
 */
export type PronunciationMessage =
  | { readonly reason: 'no-voice' | 'no-recording' | 'offline' }
  | { readonly reason: 'other-voices'; readonly voice: string };

export interface PronunciationButtonProps {
  state: PronunciationButtonState;
  /** The message open under the button, if any. */
  message?: PronunciationMessage | undefined;
  /** Speaks the Lemma, or stops it while it plays; on a disabled button, opens why. */
  onPress: () => void;
  /** Hides the message. */
  onDismissMessage: () => void;
}

/** How long the message stays when the reader leaves it. */
const MESSAGE_MS = 8000;

/**
 * The Pronunciation button of the Word card: an outlined accent circle with a
 * speaker, filled while the Lemma is spoken and faded while the Word has no
 * Recording to play. When a tap reads nothing, a message under it says why;
 * a tap closes it. On the red ground the circle and speaker take the key ink
 * instead of the accent.
 */
export function PronunciationButton({
  state,
  message,
  onPress,
  onDismissMessage,
}: PronunciationButtonProps) {
  const tokens = useTokens();
  const key = useSchemeColors('light');
  const onAccent = useOnAccent();
  const colors = onAccent
    ? { ...tokens.colors, accent: key.ink, ink: key.ink, surface: key.background }
    : tokens.colors;
  const { strings: editionStrings, voice } = useEdition();
  const strings = editionStrings.wordCard.pronunciation;
  const window = useWindowDimensions();
  const playing = state === 'playing';
  const unavailable = state === 'unavailable';
  const text = message === undefined ? undefined : messageText(message, strings);

  useEffect(() => {
    if (text === undefined) return;
    AccessibilityInfo.announceForAccessibility(text);
    const timer = setTimeout(onDismissMessage, MESSAGE_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [text, onDismissMessage]);

  return (
    <View>
      <Pressable
        testID="word-pronunciation"
        accessibilityRole="button"
        accessibilityLabel={playing ? strings.stop : strings.label}
        accessibilityState={{ disabled: unavailable }}
        {...voice}
        onPress={onPress}
        style={({ pressed }) => [
          styles.button,
          {
            borderColor: playing ? colors.accent : withAlpha(colors.accent, 0.45),
            backgroundColor: playing ? colors.accent : 'transparent',
            opacity: unavailable ? disabledOpacity : pressed ? 0.7 : 1,
          },
        ]}
      >
        <SpeakerIcon color={playing ? colors.surface : colors.accent} filled={playing} />
      </Pressable>
      {message !== undefined && text !== undefined ? (
        <Pressable
          testID={`pronunciation-${message.reason}`}
          accessibilityRole="alert"
          accessibilityLabel={text}
          accessibilityLiveRegion="polite"
          {...voice}
          onPress={onDismissMessage}
          style={[
            styles.message,
            {
              width: Math.min(voiceMessage.maxWidth, window.width - voiceMessage.margin),
              backgroundColor: colors.ink,
            },
          ]}
        >
          <Text style={[typeStyle('toast', tokens), { color: colors.surface }]}>{text}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** The text of a message, from the Edition's strings. */
function messageText(
  message: PronunciationMessage,
  strings: EditionStrings['wordCard']['pronunciation'],
): string {
  switch (message.reason) {
    case 'no-voice':
      return strings.noVoice;
    case 'no-recording':
      return strings.noRecording;
    case 'offline':
      return strings.offline;
    case 'other-voices':
      return fill(strings.otherVoices, { voice: message.voice });
  }
}

/** A speaker with two sound waves. */
function SpeakerIcon({ color, filled }: { color: string; filled: boolean }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path
        d="M11 5 6.5 9H3v6h3.5l4.5 4z"
        stroke={color}
        strokeWidth={1.8}
        strokeLinejoin="round"
        fill={filled ? color : 'none'}
      />
      <Path
        d="M15.5 9a4.5 4.5 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  // A full circle the size of the touch target (the design's 44 pt).
  button: {
    width: minTouchTarget,
    height: minTouchTarget,
    borderRadius: minTouchTarget / 2,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Inverted colours and the toast's radius and elevation, under the button.
  message: {
    position: 'absolute',
    top: minTouchTarget + space[2],
    right: 0,
    borderRadius: toastRadius,
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    ...toastElevation,
  },
});
