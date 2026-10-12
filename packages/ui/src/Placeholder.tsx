import { StyleSheet, Text, View } from 'react-native';

import { useEdition } from './EditionProvider';
import { space, typeSize } from './tokens';
import { useTokens } from './TokensProvider';

/** Stands in for a screen that a later version builds. */
export function Placeholder({ message, testID }: { message: string; testID?: string }) {
  const { colors, fontFamilies } = useTokens();
  const { voice } = useEdition();
  return (
    <View testID={testID} style={[styles.screen, { backgroundColor: colors.background }]}>
      <Text
        {...voice}
        style={[styles.message, { color: colors.muted, fontFamily: fontFamilies.ui }]}
      >
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space[8] },
  message: { fontSize: typeSize.body, fontWeight: '500', textAlign: 'center' },
});
