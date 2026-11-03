import type { BadgeState } from '@slovo/core';
import {
  BackLink,
  BadgeGrid,
  BadgeStamp,
  fill,
  ScreenTitle,
  space,
  typeStyle,
  useEdition,
  useTokens,
} from '@slovo/ui';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useComposition } from '../composition';
import { editionStrings } from '../edition/edition';
import { MascotAs } from '../mascot/mascot';
import { useSubscribed } from '../opening';
import { dayText } from './day-text';

const strings = editionStrings.settings.badges;

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
 * Every Badge of the Edition as its mark, in a grid by family under how many
 * of all are earned; each shows, and VoiceOver reads, its date or, while not earned,
 * how far its condition has come. A tap on an earned one stamps it on red.
 */
function Badges() {
  const tokens = useTokens();
  const { colors } = tokens;
  const { voice, count } = useEdition();
  const badges = useSubscribed(useComposition().badges, ({ state }) => state);
  /** The earned Badge stamped over the screen after a tap on its mark. */
  const [stamped, setStamped] = useState<BadgeState | undefined>(undefined);

  const statusOf = (badge: BadgeState) => {
    if (badge.earned) return fill(strings.earned, { date: dayText(badge.date) });
    const forms = progressForms(badge);
    if (forms === undefined) return strings.notYet;
    const { current, target } = badge.progress;
    return fill(count(forms, target), { current: String(current) });
  };

  return (
    <>
      <Text
        {...voice}
        testID="badges-count"
        style={[typeStyle('progressCount', tokens), styles.count, { color: colors.muted }]}
      >
        {fill(strings.earnedOf, {
          earned: String(badges.filter(({ earned }) => earned).length),
          total: String(badges.length),
        })}
      </Text>
      <BadgeGrid
        badges={badges}
        size="screen"
        statusOf={statusOf}
        onPress={(badge) => {
          if (badge.earned) setStamped(badge);
        }}
      />
      {stamped !== undefined && (
        <BadgeStamp
          condition={stamped.condition}
          symbol={stamped.symbol}
          name={stamped.name}
          title={editionStrings.settings.profile.badgeStamp.title}
          takeLabel={editionStrings.settings.profile.badgeStamp.take}
          mascot={<MascotAs state="celebrates" onRed />}
          onClose={() => {
            setStamped(undefined);
          }}
        />
      )}
    </>
  );
}

/** Settings › Відзнаки (ADR 0066), as the board: the Badges in a grid by family under its title. */
export function BadgesScreen() {
  const { colors } = useTokens();
  const router = useRouter();

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
        <Badges />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: space[4], paddingTop: space[2], paddingBottom: space[8] },
  section: { gap: space[3], paddingTop: space[2], paddingBottom: space[2] },
  count: { paddingBottom: space[4] },
});
