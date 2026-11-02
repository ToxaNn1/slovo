import type { ReactNode } from 'react';
import { StyleSheet, Text } from 'react-native';

import { useEdition } from '../providers/EditionProvider';
import { useSchemeColors, useTokens } from '../providers/TokensProvider';
import { space, typeStyle } from '../tokens';

/** The height of a sheet's rows and of its «Готово» button, from the design. */
export const SHEET_ROW_HEIGHT = 56;

/** How far the largest text sizes of iOS may scale a sheet's title, as a screen title. */
const TITLE_MAX_FONT_SCALE = 1.3;

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
      maxFontSizeMultiplier={TITLE_MAX_FONT_SCALE}
      style={[
        styles.title,
        typeStyle('sheetTitle', tokens),
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
    marginLeft: -2,
    paddingVertical: 10,
    paddingHorizontal: space[4],
    transform: [{ rotate: TITLE_TURN }],
    transformOrigin: 'left',
  },
});
