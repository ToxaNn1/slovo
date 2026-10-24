import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { useEdition } from '../providers/EditionProvider';
import { useTokens } from '../providers/TokensProvider';
import { disabledOpacity, googleSignInButton, space, typeSize } from '../tokens';

/** How far the largest text sizes of iOS may scale the label, so the button never outgrows its screen. */
const LABEL_MAX_FONT_SCALE = 1.3;

/**
 * Google's "G" logo, as Google's branding guidelines give it
 * (https://developers.google.com/identity/branding-guidelines), unchanged.
 */
function GoogleLogo() {
  const { logo, logoSize } = googleSignInButton;
  return (
    <Svg width={logoSize} height={logoSize} viewBox="0 0 48 48">
      <Path
        fill={logo.red}
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <Path
        fill={logo.blue}
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <Path
        fill={logo.yellow}
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <Path
        fill={logo.green}
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </Svg>
  );
}

/**
 * «Sign in with Google» in Google's branding rules: Google's "G" logo before
 * the label, on Google's white fill with its grey stroke in the light Theme
 * and on its dark fill in the dark one, `radius.button`, 50 pt tall like the
 * secondary button. While its request is on the way it shows a spinner in
 * place of the logo and takes no press; disabled, it is dimmed and takes none
 * either.
 */
export function GoogleSignInButton({
  label,
  onPress,
  busy = false,
  disabled = false,
  testID,
}: {
  label: string;
  onPress: () => void;
  /** Whether the request of the button is on the way. */
  busy?: boolean | undefined;
  disabled?: boolean | undefined;
  testID?: string | undefined;
}) {
  const { colorScheme, radii } = useTokens();
  const { voice } = useEdition();
  const theme = googleSignInButton[colorScheme];
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ busy, disabled: busy || disabled }}
      {...voice}
      disabled={busy || disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: theme.fill,
          borderColor: theme.stroke,
          borderRadius: radii.button,
          opacity: disabled && !busy ? disabledOpacity : pressed ? 0.8 : 1,
        },
      ]}
    >
      <View style={styles.content}>
        {busy ? <ActivityIndicator color={theme.label} /> : <GoogleLogo />}
        <Text
          maxFontSizeMultiplier={LABEL_MAX_FONT_SCALE}
          style={[styles.label, { color: theme.label }]}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 50,
    paddingHorizontal: space[5],
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  content: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  // Google's label is medium weight in the system's sans-serif, not the Edition's font.
  label: { flexShrink: 1, fontSize: typeSize.body, fontWeight: '500', textAlign: 'center' },
});
