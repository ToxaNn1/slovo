import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { useEdition } from '../providers/EditionProvider';
import { useInterfaceSounds } from '../providers/InterfaceSoundsProvider';
import { useSchemeColors, useTokens } from '../providers/TokensProvider';
import { buttonHeight, fontScaleCap, space, typeStyle } from '../tokens';
import { PressedTile, type TileTone } from './PressedTile';

/**
 * The design's buttons, each a pressed tile: `primary` is the red with an
 * ink label (the main action, and a destructive one), `neutral` the cream
 * tile, `onAccent` the ink tile with a cream label for a red surface,
 * `inverse` the Theme's ink tile with a label of the Theme's background, and
 * `ghost` a label with no tile.
 */
export type ButtonVariant = 'primary' | 'neutral' | 'onAccent' | 'inverse' | 'ghost';

const tones: Record<ButtonVariant, TileTone> = {
  primary: 'accent',
  neutral: 'tile',
  onAccent: 'ink',
  inverse: 'inverse',
  ghost: 'none',
};

/**
 * A button of the design (`docs/design/README.md`): the label in the
 * `buttonLabel` type role on a pressed tile of `radius.button`. A mark, such
 * as SLOVO ID's, goes before the label, and VoiceOver skips it. While its
 * request is on the way it shows a spinner beside the label and takes no
 * press; disabled, it is dimmed and takes none either.
 */
export function Button({
  variant = 'primary',
  size = 'large',
  label,
  accessibilityLabel = label,
  accessibilityHint,
  mark,
  onPress,
  busy = false,
  disabled = false,
  selected,
  testID,
}: {
  variant?: ButtonVariant;
  /** `small` is as tall as a tap area, for a button in a row or a pair. */
  size?: 'large' | 'small';
  label: string;
  /** What VoiceOver reads, where it differs from the label. */
  accessibilityLabel?: string;
  /** What VoiceOver reads after the label, such as why the button is disabled. */
  accessibilityHint?: string | undefined;
  /** What goes before the label; VoiceOver reads the label alone. */
  mark?: ReactNode;
  onPress: () => void;
  /** Whether the request of the button is on the way. */
  busy?: boolean | undefined;
  disabled?: boolean | undefined;
  /** For a button that is one of a choice: whether it is the chosen one. */
  selected?: boolean | undefined;
  testID?: string | undefined;
}) {
  const tokens = useTokens();
  const sounds = useInterfaceSounds();
  const keyColors = useSchemeColors('light');
  const { voice } = useEdition();
  const labelColor = {
    primary: keyColors.ink,
    neutral: tokens.colors.ink,
    onAccent: keyColors.background,
    inverse: tokens.colors.background,
    ghost: tokens.colors.ink,
  }[variant];
  return (
    <PressedTile
      tone={tones[variant]}
      radius={tokens.radii.button}
      onPress={() => {
        sounds.play('tap');
        onPress();
      }}
      disabled={busy || disabled}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ busy, selected }}
      faceStyle={[
        styles.face,
        { minHeight: buttonHeight[size] },
        variant === 'neutral' && {
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: tokens.colors.line,
        },
      ]}
      testID={testID}
    >
      <View style={styles.content}>
        {busy && <ActivityIndicator color={labelColor} />}
        {mark}
        <Text
          {...voice}
          maxFontSizeMultiplier={fontScaleCap.number}
          style={[styles.label, typeStyle('buttonLabel', tokens), { color: labelColor }]}
        >
          {label}
        </Text>
      </View>
    </PressedTile>
  );
}

const styles = StyleSheet.create({
  face: { paddingHorizontal: space[5], alignItems: 'center', justifyContent: 'center' },
  content: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  label: { flexShrink: 1, textAlign: 'center' },
});
