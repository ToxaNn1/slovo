import { StyleSheet, Text } from 'react-native';

import { typeSize } from './tokens';
import { useTokens } from './TokensProvider';

/** A screen's title, such as Settings, in the word family. */
export function ScreenTitle({ children }: { children: string }) {
  const { colors, fontFamilies } = useTokens();
  return (
    <Text
      accessibilityRole="header"
      style={[styles.title, { color: colors.ink, fontFamily: fontFamilies.word }]}
    >
      {children}
    </Text>
  );
}

/** The small capitalised label over a group of controls, such as "Тема". */
export function SectionLabel({ children }: { children: string }) {
  const { colors, fontFamilies } = useTokens();
  return (
    <Text
      accessibilityRole="header"
      style={[styles.label, { color: colors.muted, fontFamily: fontFamilies.ui }]}
    >
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: typeSize.screenTitle,
    lineHeight: typeSize.screenTitle * 1.2,
    fontWeight: '500',
  },
  label: {
    fontSize: typeSize.overline,
    fontWeight: '700',
    letterSpacing: typeSize.overline * 0.14,
    textTransform: 'uppercase',
  },
});
