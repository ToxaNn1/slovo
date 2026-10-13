import { StyleSheet, Text, type StyleProp, type TextStyle } from 'react-native';

import { useEdition } from './EditionProvider';
import { overlineType, typeSize } from './tokens';
import { useTokens } from './TokensProvider';

/** How far the largest text sizes of iOS may scale a screen title. */
const TITLE_MAX_FONT_SCALE = 1.3;

/** A screen's title, such as Settings, in the word family. */
export function ScreenTitle({ children }: { children: string }) {
  const { colors, fontFamilies } = useTokens();
  const { voice } = useEdition();
  return (
    <Text
      accessibilityRole="header"
      {...voice}
      // A 34 pt title at the largest accessibility sizes would break a word across lines.
      maxFontSizeMultiplier={TITLE_MAX_FONT_SCALE}
      style={[styles.title, { color: colors.ink, fontFamily: fontFamilies.word }]}
    >
      {children}
    </Text>
  );
}

/** The small capitalised label over a group of controls or a card's section, such as "Тема". */
export function SectionLabel({
  children,
  style,
}: {
  children: string;
  style?: StyleProp<TextStyle>;
}) {
  const { colors, fontFamilies } = useTokens();
  const { voice } = useEdition();
  return (
    <Text
      accessibilityRole="header"
      {...voice}
      style={[styles.label, { color: colors.muted, fontFamily: fontFamilies.ui }, style]}
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
  label: overlineType,
});
