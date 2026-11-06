import { StyleSheet, Text, View, type StyleProp, type TextStyle } from 'react-native';

import { useEdition } from '../providers/EditionProvider';
import { typeRoles, typeStyle } from '../tokens';
import { useTokens } from '../providers/TokensProvider';
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
  const tokens = useTokens();
  const { voice } = useEdition();
  return (
    <View style={styles.room}>
      <WholeWordsText
        accessibilityRole="header"
        {...voice}
        maxFontSizeMultiplier={TITLE_MAX_FONT_SCALE}
        text={children}
        typeRole="screenTitle"
        tracking={TITLE_TRACKING}
        style={[typeStyle('screenTitle', tokens), { color: tokens.colors.ink }]}
      />
    </View>
  );
}

/** The small capitalised label over a group of controls or a card's section, such as "Тема". */
export function SectionLabel({
  children,
  style,
  oneLine = false,
}: {
  children: string;
  style?: StyleProp<TextStyle>;
  /** Kept on one line, shrunk to fit rather than broken inside a word, where the room is short. */
  oneLine?: boolean;
}) {
  const tokens = useTokens();
  const { voice } = useEdition();
  return (
    <Text
      accessibilityRole="header"
      {...voice}
      {...(oneLine ? { numberOfLines: 1, adjustsFontSizeToFit: true } : {})}
      style={[typeStyle('sectionLabel', tokens), { color: tokens.colors.muted }, style]}
    >
      {children}
    </Text>
  );
}

const TITLE_TRACKING = typeRoles.screenTitle.letterSpacing / typeRoles.screenTitle.size;

const styles = StyleSheet.create({
  room: { flexGrow: 1 },
});
