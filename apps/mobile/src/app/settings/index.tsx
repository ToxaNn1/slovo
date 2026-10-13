import { FontSizeSchema, ThemeSchema } from '@slovo/contracts';
import {
  FontSizePreview,
  NavigationRow,
  ScreenTitle,
  SectionLabel,
  SegmentedControl,
  SettingsGroup,
  SoonRow,
  SwitchRow,
  space,
  useTokens,
} from '@slovo/ui';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { editionStrings } from '../../edition';
import { useSettings } from '../../settings';

const strings = editionStrings.settings;

const themeSegments = ThemeSchema.options.map((theme) => ({
  value: theme,
  label: strings.themes[theme],
  testID: `settings-theme-${theme}`,
}));

const fontSizeSegments = FontSizeSchema.options.map((fontSize) => ({
  value: fontSize,
  label: strings.fontSizes[fontSize],
  testID: `settings-font-size-${fontSize}`,
}));

/**
 * Settings: the Theme, the font size and the rows of the design. The rows of
 * later versions show as soon; Мій Мікс and Приховані записи wait for their
 * screens (#109, #110).
 */
export default function SettingsScreen() {
  const { current, update } = useSettings();
  const { colors } = useTokens();
  const router = useRouter();
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
        <View style={styles.section}>
          <SectionLabel>{strings.fontSize}</SectionLabel>
          <FontSizePreview
            testID="settings-font-size-preview"
            lemma={strings.fontSizePreview.lemma}
            definition={strings.fontSizePreview.definition}
          />
          <SegmentedControl
            accessibilityLabel={strings.fontSize}
            segments={fontSizeSegments}
            selected={current.fontSize}
            onSelect={(fontSize) => {
              update({ fontSize });
            }}
          />
        </View>
        <View style={styles.section}>
          <SettingsGroup>
            <SoonRow testID="settings-row-notifications" label={strings.rows.notifications} />
            <SoonRow testID="settings-row-my-mix" label={strings.rows.myMix} />
            <SoonRow testID="settings-row-hidden" label={strings.rows.hidden} />
          </SettingsGroup>
        </View>
        <View style={styles.section}>
          <SectionLabel>{strings.sounds.section}</SectionLabel>
          <SettingsGroup>
            <SoonRow testID="settings-row-sounds" label={strings.sounds.sounds} control="switch" />
            <SwitchRow
              testID="settings-vibration"
              label={strings.sounds.vibration}
              value={current.vibration}
              onChange={(vibration) => {
                update({ vibration });
              }}
            />
            <SoonRow testID="settings-row-music" label={strings.sounds.music} control="slider" />
          </SettingsGroup>
        </View>
        <View style={styles.section}>
          <SettingsGroup>
            <SoonRow testID="settings-row-widgets" label={strings.rows.widgets} />
            <NavigationRow
              testID="settings-row-about"
              label={strings.rows.about}
              onPress={() => {
                router.push('/settings/about');
              }}
            />
          </SettingsGroup>
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
