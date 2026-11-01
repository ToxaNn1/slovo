import type { MascotState } from '@slovo/contracts';
import { StyleSheet, Text, View } from 'react-native';

import { useEdition } from '../providers/EditionProvider';
import { space, typeSize } from '../tokens';
import { useTokens } from '../providers/TokensProvider';

/**
 * The Mascot in a state, with the Edition's short line for it. It is silent
 * and takes no touch, so it never stands in the reader's way. Its look and
 * motion wait for the design: until then it is the line alone.
 */
export function Mascot({ state, line }: { state: MascotState; line: string }) {
  const { colors, fontFamilies } = useTokens();
  const { voice } = useEdition();
  return (
    <View testID={`mascot-${state}`} pointerEvents="none" style={styles.mascot}>
      <Text {...voice} style={[styles.line, { color: colors.muted, fontFamily: fontFamilies.ui }]}>
        {line}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  mascot: { alignItems: 'center', padding: space[4] },
  line: { fontSize: typeSize.body, fontWeight: '500', textAlign: 'center' },
});
