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

import { minTouchTarget, space } from './tokens';
import { useTokens } from './TokensProvider';
import { withAlpha, type WordCardStrings } from './WordCard';

/**
 * What the button shows: ready, the Lemma being spoken, or the message that
 * the device has no voice for the Edition's language.
 */
export type PronunciationButtonState = 'idle' | 'playing' | 'no-voice';

export interface PronunciationButtonProps {
  state: PronunciationButtonState;
  strings: WordCardStrings['pronunciation'];
  /** Speaks the Lemma, or stops it while it plays. */
  onPress: () => void;
  /** Hides the missing-voice message. */
  onDismissMessage: () => void;
  /** The Edition's language (BCP 47), so VoiceOver reads the message in its voice. */
  language?: string;
}

/** How long the missing-voice message stays when the reader leaves it. */
const MESSAGE_MS = 8000;

/** The message's widest, and its distance from the screen's edges. */
const MESSAGE_WIDTH = 260;
const MESSAGE_MARGIN = 64;

/**
 * The Pronunciation button of the Word card: an outlined accent circle with a
 * speaker, filled while the Lemma is spoken. When the device has no voice for
 * the language, a message opens under it; a tap closes it.
 */
export function PronunciationButton({
  state,
  strings,
  onPress,
  onDismissMessage,
  language,
}: PronunciationButtonProps) {
  const { colors, fontFamilies } = useTokens();
  const window = useWindowDimensions();
  const playing = state === 'playing';
  const voice = language === undefined ? {} : { accessibilityLanguage: language };

  useEffect(() => {
    if (state !== 'no-voice') return;
    AccessibilityInfo.announceForAccessibility(strings.noVoice);
    const timer = setTimeout(onDismissMessage, MESSAGE_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [state, strings.noVoice, onDismissMessage]);

  return (
    <View>
      <Pressable
        testID="word-pronunciation"
        accessibilityRole="button"
        accessibilityLabel={playing ? strings.stop : strings.label}
        {...voice}
        onPress={onPress}
        style={({ pressed }) => [
          styles.button,
          {
            borderColor: playing ? colors.accent : withAlpha(colors.accent, 0.45),
            backgroundColor: playing ? colors.accent : 'transparent',
            opacity: pressed ? 0.7 : 1,
          },
        ]}
      >
        <SpeakerIcon color={playing ? colors.surface : colors.accent} filled={playing} />
      </Pressable>
      {state === 'no-voice' ? (
        <Pressable
          testID="pronunciation-no-voice"
          accessibilityRole="alert"
          accessibilityLabel={strings.noVoice}
          accessibilityLiveRegion="polite"
          {...voice}
          onPress={onDismissMessage}
          style={[
            styles.message,
            {
              width: Math.min(MESSAGE_WIDTH, window.width - MESSAGE_MARGIN),
              backgroundColor: colors.ink,
            },
          ]}
        >
          <Text
            style={[styles.messageText, { color: colors.surface, fontFamily: fontFamilies.ui }]}
          >
            {strings.noVoice}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
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
    borderRadius: 6,
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 15,
  },
  messageText: { fontSize: 14, lineHeight: 20, fontWeight: '500' },
});
