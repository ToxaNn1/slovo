import type { BadgeState } from '@slovo/core';
import { BackLink, fill, ScreenTitle, space, typeSize, useEdition, useTokens } from '@slovo/ui';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useComposition } from '../composition';
import { editionStrings } from '../edition/edition';
import { useSubscribed } from '../opening';

const strings = editionStrings.settings.badges;

/** A local date `YYYY-MM-DD` as the Badges screen shows it, e.g. «20.10.2026». */
const fullDate = (date: string) => `${date.slice(8, 10)}.${date.slice(5, 7)}.${date.slice(0, 4)}`;

/** The progress forms of an unearned Badge's condition; none for a condition of one first time. */
function progressForms({ condition }: BadgeState) {
  switch (condition.kind) {
    case 'streak':
    case 'dailyCrosswordRun':
      return strings.progress.days;
    case 'confirmedEntries':
      return strings.progress.entries;
    case 'rightAnswers':
      return strings.progress.rightAnswers;
    case 'level':
      return strings.progress.level;
    case 'gameWin':
    case 'rightOnRarity':
      return undefined;
  }
}

/**
 * Settings › Відзнаки (ADR 0066): every Badge of the Edition in its order,
 * earned with its date or, while not, with how far its condition has come.
 */
export function BadgesScreen() {
  const { colors, fontFamilies } = useTokens();
  const { voice, count } = useEdition();
  const router = useRouter();
  const badges = useSubscribed(useComposition().badges, ({ state }) => state);
  const nameStyle = [styles.name, { color: colors.ink, fontFamily: fontFamilies.ui }];
  const textStyle = [styles.text, { color: colors.muted, fontFamily: fontFamilies.ui }];

  const statusOf = (badge: BadgeState) => {
    if (badge.earned) return fill(strings.earned, { date: fullDate(badge.date) });
    const forms = progressForms(badge);
    if (forms === undefined) return strings.notYet;
    const { current, target } = badge.progress;
    return fill(count(forms, target), { current: String(current) });
  };

  return (
    <SafeAreaView
      testID="badges"
      edges={['top']}
      style={[styles.screen, { backgroundColor: colors.background }]}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <BackLink
          testID="badges-back"
          label={editionStrings.settings.title}
          onPress={() => {
            router.back();
          }}
        />
        <View style={styles.section}>
          <ScreenTitle>{strings.title}</ScreenTitle>
        </View>
        {badges.map((badge) => (
          <View key={badge.id} testID={`badge-${badge.id}`} style={styles.badge}>
            <Text {...voice} style={nameStyle}>
              {badge.name}
            </Text>
            <Text {...voice} testID={`badge-${badge.id}-status`} style={textStyle}>
              {statusOf(badge)}
            </Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: space[5], paddingTop: space[2], paddingBottom: space[8] },
  section: { gap: space[3], paddingTop: space[2], paddingBottom: space[5] },
  badge: { gap: space[1], paddingBottom: space[4] },
  name: { fontSize: typeSize.body, lineHeight: typeSize.body * 1.4 },
  text: { fontSize: typeSize.body, lineHeight: typeSize.body * 1.5 },
});
