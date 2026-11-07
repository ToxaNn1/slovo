import type { Plural } from '@slovo/contracts';
import type { BadgeState } from '@slovo/core';
import {
  BackLink,
  BadgeGrid,
  fill,
  ScreenTitle,
  space,
  typeStyle,
  useEdition,
  useTokens,
} from '@slovo/ui';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useComposition } from '../composition';
import { useBadgeOpening, useBadgeStatus } from './badge-opening';
import { edition, editionStrings } from '../edition/edition';
import { useSubscribed } from '../opening';

const strings = editionStrings.settings.badges;

/** The names of `modes`, joined by the list's commas. */
const modeNames = (modes: readonly string[]) =>
  modes.map((mode) => editionStrings.game.modes[mode]?.title ?? mode).join(', ');

/** What a Badge's condition asks, in the Edition's words (ADR 0085). */
function conditionText({ condition }: BadgeState, count: (forms: Plural, n: number) => string) {
  const words = strings.conditions;
  switch (condition.kind) {
    case 'streak':
      return count(words.streak, condition.days);
    case 'confirmedEntries':
      return count(words.confirmedEntries, condition.entries);
    case 'gameWin':
      return fill(words.gameWin, { modes: modeNames(condition.modes) });
    case 'dailyCrosswordRun':
      return count(words.dailyCrosswordRun, condition.days);
    case 'rightAnswers':
      return fill(count(words.rightAnswers, condition.count), {
        modes: modeNames(condition.modes),
      });
    case 'rightOnRarity':
      return fill(words.rightOnRarity, { rarity: String(condition.rarity) });
    case 'level':
      return fill(words.level, { level: String(condition.level) });
    case 'flawlessGame':
      return fill(words.flawlessGame, { modes: modeNames(condition.modes) });
    case 'rightRun':
      return fill(count(words.rightRun, condition.count), { modes: modeNames(condition.modes) });
  }
}

/**
 * Every Badge of the Edition as its mark, in a grid by the Edition's Badge
 * families under how many of all are earned; each shows its condition and
 * shows, and VoiceOver reads, its date or, while not earned, how far its
 * condition has come. A tap opens it (`useBadgeOpening`).
 */
function Badges() {
  const tokens = useTokens();
  const { colors } = tokens;
  const { voice, count } = useEdition();
  const badges = useSubscribed(useComposition().badges, ({ state }) => state);
  const { statusOf } = useBadgeStatus();
  const { onPress, opening } = useBadgeOpening();

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
        families={edition.badgeFamilies}
        badges={badges}
        size="screen"
        statusOf={statusOf}
        conditionOf={(badge) => conditionText(badge, count)}
        onPress={onPress}
      />
      {opening}
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
