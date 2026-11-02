import { StyleSheet, Text, View } from 'react-native';

import { useEdition } from '../providers/EditionProvider';
import { space, typeStyle } from '../tokens';
import { useTokens } from '../providers/TokensProvider';

/** One muted line centred on a screen with nothing else to show, such as a Feed without Words. */
export function Placeholder({ message, testID }: { message: string; testID?: string }) {
  const tokens = useTokens();
  const { colors } = tokens;
  const { voice } = useEdition();
  return (
    <View testID={testID} style={[styles.screen, { backgroundColor: colors.background }]}>
      <Text {...voice} style={[typeStyle('sub', tokens), styles.message, { color: colors.muted }]}>
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space[8] },
  message: { textAlign: 'center' },
});
