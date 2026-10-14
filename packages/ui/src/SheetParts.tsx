import type { ReactNode } from 'react';
import { StyleSheet, Text } from 'react-native';

import { useEdition } from './EditionProvider';
import { typeSize } from './tokens';
import { useTokens } from './TokensProvider';

/** The height of a sheet's rows and of its «Готово» button, from the design. */
export const SHEET_ROW_HEIGHT = 56;

/** The title of a bottom sheet: the Edition's word family, read as a header. */
export function SheetTitle({ children }: { children: ReactNode }) {
  const { colors, fontFamilies } = useTokens();
  const { voice } = useEdition();
  return (
    <Text
      accessibilityRole="header"
      {...voice}
      style={[styles.title, { color: colors.ink, fontFamily: fontFamilies.word }]}
    >
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: typeSize.sheetTitle, fontWeight: '500' },
});
