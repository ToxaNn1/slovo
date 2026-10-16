import { StyleSheet, Text, View, type StyleProp, type TextStyle } from 'react-native';

import { useEdition } from './EditionProvider';
import { overlineType, typeSize } from './tokens';
import { useTokens } from './TokensProvider';
import { WholeWordsText } from './WholeWordsText';

/** How far the largest text sizes of iOS may scale a screen title. */
const TITLE_MAX_FONT_SCALE = 1.3;

/**
 * A screen's title, such as Settings, in the word family. It wraps between
 * words and shrinks to keep a long one whole: on an iPhone SE, «Налаштування»
 * is wider than the line even at the 1.3× cap. The title grows to the room
 * left in a row: its line is measured from its own width, which would shrink
 * the text again and again if the title only hugged it. A name that may be
 * wider than the row (a Collection's) goes in a view that also shrinks.
 */
export function ScreenTitle({ children }: { children: string }) {
  const { colors, fontFamilies } = useTokens();
  const { voice } = useEdition();
  return (
    <View style={styles.room}>
      <WholeWordsText
        accessibilityRole="header"
        {...voice}
        maxFontSizeMultiplier={TITLE_MAX_FONT_SCALE}
        text={children}
        size={TITLE_SIZE}
        tracking={0}
        style={[styles.title, { color: colors.ink, fontFamily: fontFamilies.word }]}
      />
    </View>
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

const TITLE_SIZE = { fontSize: typeSize.screenTitle, lineHeight: typeSize.screenTitle * 1.2 };

const styles = StyleSheet.create({
  room: { flexGrow: 1 },
  title: { fontWeight: '500' },
  label: overlineType,
});
