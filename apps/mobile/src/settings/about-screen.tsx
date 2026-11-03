import {
  BackLink,
  CardCorners,
  fill,
  NavigationRow,
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
 * About: the Edition's name, the installed build and the OTA update it runs
 * (ADR 0062), so a bug report names the exact code, while the binary reports
 * them; what SLOVO is and where its words come from, and its privacy policy
 * and terms, which open in the browser. Suggesting a word and reporting a
 * mistake wait for the backend (0.7).
 */
export function AboutScreen() {
  const tokens = useTokens();
  const { colors, radii } = tokens;
  const wordmark = typeStyle('wordmark', tokens);
  const router = useRouter();
  const { voice } = useEdition();
  const build = installedBuild();
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
        <View style={styles.identity}>
          <Text
            accessibilityRole="header"
            {...voice}
            style={[
              wordmark,
              // The last letter's spacing would push the word off centre.
              { paddingLeft: wordmark.letterSpacing, color: colors.ink },
            ]}
          >
            {edition.displayName}
          </Text>
          <Text
            {...voice}
            style={[typeStyle('sub', tokens), styles.editionLine, { color: colors.muted }]}
          >
            {strings.about.editionLine}
          </Text>
          {build !== undefined && (
            <Text
              testID="about-version"
              {...voice}
              style={[typeStyle('sub', tokens), styles.editionLine, { color: colors.muted }]}
            >
              {fill(strings.about.versionLine, { version: build.version, build: build.build })}
            </Text>
          )}
          {build?.updateId !== undefined && (
            <Text
              testID="about-update"
              {...voice}
              style={[typeStyle('sub', tokens), styles.editionLine, { color: colors.muted }]}
            >
              {fill(strings.about.updateLine, { id: build.updateId })}
            </Text>
          )}
        </View>
        <View
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: radii.card },
          ]}
        >
          <CardCorners />
          <Text
            testID="about-description"
            {...voice}
            style={[typeStyle('aboutDescription', tokens), { color: colors.ink }]}
          >
            {strings.about.description}
          </Text>
          <Text
            testID="about-sources"
            {...voice}
            style={[typeStyle('sub', tokens), { color: colors.muted }]}
          >
            {strings.about.sources}
          </Text>
        </View>
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
  identity: { alignItems: 'center', gap: space[2], marginVertical: space[6] },
  editionLine: { textAlign: 'center' },
  card: {
    gap: space[3],
    padding: space[6],
    borderWidth: StyleSheet.hairlineWidth,
  },
  section: { gap: space[3], marginTop: space[6] },
});
