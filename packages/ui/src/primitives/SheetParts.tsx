import type { ReactNode } from 'react';
import { StyleSheet, Text } from 'react-native';

import { useEdition } from '../providers/EditionProvider';
import { useSchemeColors, useTokens } from '../providers/TokensProvider';
import { fontScaleCap, space, typeStyle } from '../tokens';

/** The title band's padding above and below, and how far it reaches left of the sheet's edge, from the design. */
const TITLE_BAND = { vertical: 10, outset: 2 };

/** The title's turn, from the design: along the sheet's slanted top. */
const TITLE_TURN = '-4.4deg';

/**
 * The title of a bottom sheet, the first thing in it: the design's black band
 * turned along the slanted top, cream capitals in the word family on the key
 * ink in both Themes, read as a header.
 */
export function SheetTitle({ children }: { children: ReactNode }) {
  const tokens = useTokens();
  const key = useSchemeColors('light');
  const { voice } = useEdition();
  return (
    <Text
      accessibilityRole="header"
      {...voice}
      maxFontSizeMultiplier={fontScaleCap.number}
      style={[
        typeStyle('sheetTitle', tokens),
        styles.title,
        { color: key.background, backgroundColor: key.ink },
      ]}
    >
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  title: {
    alignSelf: 'flex-start',
    marginLeft: -TITLE_BAND.outset,
    // The band's own top padding holds the capitals' marks, so the line
    // takes none of the role's room.
    paddingTop: TITLE_BAND.vertical,
    paddingBottom: TITLE_BAND.vertical,
    marginTop: 0,
    paddingHorizontal: space[4],
    transform: [{ rotate: TITLE_TURN }],
    transformOrigin: 'left',
  },
});
