import { StyleSheet, View } from 'react-native';

import { WholeLinesText } from '../primitives/WholeLines';
import { useEdition } from '../providers/EditionProvider';
import { useTokens } from '../providers/TokensProvider';
import { typeRoles, typeStyle } from '../tokens';

const role = typeRoles.exampleMark;

/**
 * The board sets the mark at 54/.6 in a box 26 tall and lets the glyph
 * overflow it. The word font (Unbounded Black) draws a line of 1.24 em, its
 * ascent .995 and descent .245, so drawn at its own line and lifted by the
 * board's half-leading the « lands where the board puts it, inside the tab.
 */
const BOARD_LINE = 0.6;
const FONT_LINE = 0.995 + 0.245;
const lift = ((BOARD_LINE - FONT_LINE) * role.size) / 2;

/**
 * The big red quote mark over a card's first Example in its tab «Приклад»
 * (boards p1 and XEntry2 e7): the opening one of the Edition's quote around
 * an Example, or nothing when that quote has none. The Word card and the
 * Idiom card share it. A line set tighter than the font cut the glyph's top
 * on iOS and the tab clipped what rose over it, leaving two skewed bars.
 */
export function ExampleMark({ testID }: { testID: string }) {
  const tokens = useTokens();
  const { strings } = useEdition();
  const [mark = ''] = strings.wordCard.example.split('{text}');
  if (mark === '') return null;
  return (
    <View
      testID={`${testID}-box`}
      style={styles.box}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <WholeLinesText
        testID={testID}
        allowFontScaling={false}
        style={[typeStyle('exampleMark', tokens), styles.mark, { color: tokens.colors.accent }]}
      >
        {mark}
      </WholeLinesText>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { height: role.lineHeight },
  mark: {
    position: 'absolute',
    top: lift,
    left: 0,
    // The font's own line, which iOS draws whole; the box keeps the board's 26.
    lineHeight: FONT_LINE * role.size,
    paddingTop: 0,
    marginTop: 0,
    includeFontPadding: false,
  },
});
