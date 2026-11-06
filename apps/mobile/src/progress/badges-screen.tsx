import type { Plural } from '@slovo/contracts';
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
import { edition, editionStrings } from '../edition/edition';
import { MascotAs } from '../mascot/mascot';
import { useSubscribed } from '../opening';
import { dayText } from './day-text';

const strings = editionStrings.settings.badges;

/** The shape of a Badge's family. */
export const shapeOf = ({ family }: BadgeState) =>
  edition.badgeFamilies.find(({ id }) => id === family)?.shape ?? 'circle';

/** The progress forms of an unearned Badge's condition; none for a condition of one first time. */
function progressForms({ condition }: BadgeState) {
  switch (condition.kind) {
    case 'streak':
    case 'dailyCrosswordRun':
      return strings.progress.days;
    case 'confirmedEntries':
      return strings.progress.entries;
    case 'rightAnswers':
    case 'rightRun':
      return strings.progress.rightAnswers;
    case 'level':
      return strings.progress.level;
    case 'gameWin':
    case 'rightOnRarity':
    case 'flawlessGame':
      return undefined;
  }
}

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
 * condition has come. A tap on an earned one stamps it on red and opens it,
 * which ends its «НОВА» mark (ADR 0085).
 */
function Badges() {
  const tokens = useTokens();
  const { colors } = tokens;
  const { voice, count } = useEdition();
  const composed = useComposition().badges;
  const badges = useSubscribed(composed, ({ state }) => state);
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
        families={edition.badgeFamilies}
        badges={badges}
        size="screen"
        statusOf={statusOf}
        conditionOf={(badge) => conditionText(badge, count)}
        onPress={(badge) => {
          if (!badge.earned) return;
          setStamped(badge);
          void composed.open(badge.id).catch(() => undefined);
        }}
      />
      {stamped !== undefined && (
        <BadgeStamp
          shape={shapeOf(stamped)}
          symbol={stamped.symbol}
          name={stamped.name}
          title={editionStrings.settings.profile.badgeStamp.title}
          takeLabel={editionStrings.settings.profile.badgeStamp.take}
          mascot={<MascotAs state="celebrates" onRed />}
          isNew={stamped.earned && stamped.isNew}
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
