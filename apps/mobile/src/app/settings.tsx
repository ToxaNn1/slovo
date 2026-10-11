import { ThemeSchema } from '@slovo/contracts';
import { ScreenTitle, SectionLabel, SegmentedControl, space, useTokens } from '@slovo/ui';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { editionStrings } from '../edition';
import { useSettings } from '../settings';

const strings = editionStrings.settings;

const themeSegments = ThemeSchema.options.map((theme) => ({
  value: theme,
  label: strings.themes[theme],
  testID: `settings-theme-${theme}`,
}));

/** Settings in 0.2: the Theme. The other rows arrive with their features. */
export default function SettingsScreen() {
  const { current, update } = useSettings();
  const { colors } = useTokens();
  return (
    <SafeAreaView
      testID="settings"
      edges={['top']}
      style={[styles.screen, { backgroundColor: colors.background }]}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenTitle>{strings.title}</ScreenTitle>
        <View style={styles.section}>
          <SectionLabel>{strings.theme}</SectionLabel>
          <SegmentedControl
            accessibilityLabel={strings.theme}
            segments={themeSegments}
            selected={current.theme}
            onSelect={(theme) => {
              update({ theme });
            }}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: space[5], paddingTop: space[6], paddingBottom: space[8] },
  section: { gap: space[3], marginTop: space[8] },
});
