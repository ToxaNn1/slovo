import {
  BackLink,
  CardCorners,
  fill,
  SectionLabel,
  SettingsGroup,
  SoonRow,
  space,
  typeSize,
  useEdition,
  useTokens,
} from '@slovo/ui';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { editionStrings } from '../../edition/edition';

const strings = editionStrings.settings;

/** The version of the app, as the build declares it. */
const version = Constants.expoConfig?.version ?? '';

/**
 * About: the Edition's name and version, what SLOVO is and where its words
 * come from. Suggesting a word and reporting a mistake wait for the backend (0.7).
 */
export default function AboutScreen() {
  const { colors, fontFamilies, radii } = useTokens();
  const router = useRouter();
  const { voice } = useEdition();
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
            style={[styles.wordmark, { color: colors.ink, fontFamily: fontFamilies.word }]}
          >
            {editionStrings.splash.wordmark}
          </Text>
          <Text
            {...voice}
            style={[styles.editionLine, { color: colors.muted, fontFamily: fontFamilies.ui }]}
          >
            {fill(strings.about.editionLine, { version })}
          </Text>
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
            style={[styles.description, { color: colors.ink, fontFamily: fontFamilies.word }]}
          >
            {strings.about.description}
          </Text>
          <Text
            testID="about-sources"
            {...voice}
            style={[styles.sources, { color: colors.muted, fontFamily: fontFamilies.ui }]}
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
      </ScrollView>
    </SafeAreaView>
  );
}

const WORDMARK_SIZE = 32;

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: space[5], paddingTop: space[2], paddingBottom: space[8] },
  identity: { alignItems: 'center', gap: space[2], marginVertical: space[6] },
  wordmark: {
    fontSize: WORDMARK_SIZE,
    fontWeight: '500',
    letterSpacing: WORDMARK_SIZE * 0.3,
    // The last letter's spacing would push the word off centre.
    paddingLeft: WORDMARK_SIZE * 0.3,
  },
  editionLine: { fontSize: typeSize.body, textAlign: 'center' },
  card: {
    gap: space[3],
    padding: space[6],
    borderWidth: StyleSheet.hairlineWidth,
  },
  description: { fontSize: 22, lineHeight: 30, fontWeight: '500' },
  sources: { fontSize: typeSize.body },
  section: { gap: space[3], marginTop: space[6] },
});
