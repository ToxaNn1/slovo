import { StyleSheet, Text, useColorScheme, View } from 'react-native';

import { colors, fontSize, space } from './tokens';

/** Stands in for a screen that a later version builds. */
export function Placeholder({ message, testID }: { message: string; testID?: string }) {
  const palette = colors[useColorScheme() === 'dark' ? 'dark' : 'light'];
  return (
    <View testID={testID} style={[styles.screen, { backgroundColor: palette.background }]}>
      <Text style={[styles.message, { color: palette.muted }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl },
  message: { fontSize: fontSize.body, textAlign: 'center' },
});
