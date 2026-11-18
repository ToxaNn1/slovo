import {
  AboutPanel,
  BackHeader,
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

import { deviceFacts } from '../device/device-facts';
import { edition, editionStrings } from '../edition/edition';
import { installedBuild } from './installed-build';
import { openLegalPage } from './legal-page';

const strings = editionStrings.settings;

/**
 * About: the Edition's name on the red shout panel, the app's version and the installed build
 * (ADR 0062) and the Update channel it listens to (ADR 0167), so a bug report names the code; what SLOVO is and where its words come from, and its privacy policy
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
      <View style={styles.bar}>
        <BackHeader
          titleRole="settingsSubTitle"
          title={strings.rows.about}
          back={{
            label: strings.title,
            testID: 'about-back',
            onPress: () => {
              router.back();
            },
          }}
        />
      </View>
      <ScrollView testID="about-scroll" contentContainerStyle={styles.content}>
        <View style={styles.panel}>
          <AboutPanel testID="about-panel" name={edition.displayName} glyph={strings.about.glyph} />
        </View>
        <SettingsGroup>
          <View style={styles.block}>
            <Text {...voice} style={[typeStyle('rowLabel', tokens), { color: colors.ink }]}>
              {strings.about.editionLine}
            </Text>
            <Text testID="about-version" {...voice} style={sub}>
              {build.build === undefined
                ? fill(strings.about.versionAlone, { version: build.version })
                : fill(strings.about.versionLine, { version: build.version, build: build.build })}
            </Text>
            {deviceFacts.updateChannel !== undefined && (
              <Text testID="about-channel" {...voice} style={sub}>
                {fill(strings.about.channelLine, { channel: deviceFacts.updateChannel })}
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
  // The back header stays above the list, so the list scrolls under it, not the header under the status bar.
  bar: { paddingHorizontal: space[5], paddingTop: space[2] },
  content: { paddingHorizontal: space[5], paddingBottom: space[8] },
  panel: { marginTop: space[3], marginBottom: space[4] },
  block: { gap: space[1], paddingHorizontal: space[4], paddingVertical: rowPadding },
  description: { gap: space[3] },
  section: { gap: space[3], marginTop: space[6] },
});
