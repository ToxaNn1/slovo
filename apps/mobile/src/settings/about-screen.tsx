import {
  AboutPanel,
  BackLink,
  fill,
  NavigationRow,
  rowPadding,
  SectionLabel,
  SettingsGroup,
  SoonRow,
  space,
  typeStyle,
  useEdition,
  useTokens,
} from '@slovo/ui';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { edition, editionStrings } from '../edition/edition';
import { installedBuild } from './installed-build';
import { openLegalPage } from './legal-page';

const strings = editionStrings.settings;

/**
 * About: the Edition's name on the red shout panel, the installed build and the OTA update it runs
 * (ADR 0062), so a bug report names the exact code, while the binary reports
 * them; what SLOVO is and where its words come from, and its privacy policy
 * and terms, which open in the browser. Suggesting a word and reporting a
 * mistake wait for the backend (0.7).
 */
export function AboutScreen() {
  const tokens = useTokens();
  const { colors } = tokens;
  const router = useRouter();
  const { voice } = useEdition();
  const build = installedBuild();
  const sub = [typeStyle('rowSub', tokens), { color: colors.muted }];
  return (
    <SafeAreaView
      testID="about"
      edges={['top']}
      style={[styles.screen, { backgroundColor: colors.background }]}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <BackLink
          testID="about-back"
          label={strings.title}
          onPress={() => {
            router.back();
          }}
        />
        <View style={styles.panel}>
          <AboutPanel testID="about-panel" name={edition.displayName} glyph={strings.about.glyph} />
        </View>
        <SettingsGroup>
          <View style={styles.block}>
            <Text {...voice} style={[typeStyle('rowLabel', tokens), { color: colors.ink }]}>
              {strings.about.editionLine}
            </Text>
            {build !== undefined && (
              <Text testID="about-version" {...voice} style={sub}>
                {fill(strings.about.versionLine, { version: build.version, build: build.build })}
              </Text>
            )}
            {build?.updateId !== undefined && (
              <Text testID="about-update" {...voice} style={sub}>
                {fill(strings.about.updateLine, { id: build.updateId })}
              </Text>
            )}
          </View>
          <View style={[styles.block, styles.description]}>
            <Text
              testID="about-description"
              {...voice}
              style={[typeStyle('aboutDescription', tokens), { color: colors.ink }]}
            >
              {strings.about.description}
            </Text>
            <Text testID="about-sources" {...voice} style={sub}>
              {strings.about.sources}
            </Text>
          </View>
        </SettingsGroup>
        <View style={styles.section}>
          <SectionLabel>{strings.about.feedback}</SectionLabel>
          <SettingsGroup>
            <SoonRow
              testID="about-row-suggest-word"
              label={strings.about.suggestWord.title}
              subtitle={strings.about.suggestWord.subtitle}
            />
            <SoonRow
              testID="about-row-report-error"
              label={strings.about.reportError.title}
              subtitle={strings.about.reportError.subtitle}
            />
          </SettingsGroup>
        </View>
        <View style={styles.section}>
          <SettingsGroup>
            <NavigationRow
              testID="about-row-privacy"
              label={strings.about.privacyPolicy}
              onPress={() => {
                openLegalPage('privacy');
              }}
            />
            <NavigationRow
              testID="about-row-terms"
              label={strings.about.terms}
              onPress={() => {
                openLegalPage('terms');
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
  content: { paddingHorizontal: space[5], paddingTop: space[2], paddingBottom: space[8] },
  panel: { marginTop: space[3], marginBottom: space[4] },
  block: { gap: space[1], paddingHorizontal: space[4], paddingVertical: rowPadding },
  description: { gap: space[3] },
  section: { gap: space[3], marginTop: space[6] },
});
