import {
  BackLink,
  BadgeFamilies,
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
import { conditionOf, useBadgeOpening, useBadgeStatus } from './badge-opening';
import { edition, editionStrings } from '../edition/edition';
import { useEditionInEffect } from '../edition/remote-switches';
import { useSubscribed } from '../opening';

const strings = editionStrings.settings.badges;

/**
 * The Badge families overview, while its Feature Switch is on, then every
 * Badge of the Edition as a card, by the Edition's Badge families, under how
 * many of all are earned; each card shows its name, its condition and its
 * status, «Отримано» or «Ще ні · N%» (ADR 0145). A tap opens it
 * (`useBadgeOpening`).
 */
function Badges() {
  const tokens = useTokens();
  const { colors } = tokens;
  const { voice } = useEdition();
  const badges = useSubscribed(useComposition().badges, ({ state }) => state);
  const { statusOf } = useBadgeStatus();
  const { onPress, opening } = useBadgeOpening();
  const { isFeatureEnabled } = useEditionInEffect();

  return (
    <>
      {isFeatureEnabled('badgeFamiliesOverview') && (
        <View style={styles.families}>
          <BadgeFamilies families={edition.badgeFamilies} badges={badges} />
        </View>
      )}
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
        conditionOf={conditionOf}
        onPress={onPress}
      />
      {opening}
    </>
  );
}

/** Settings › Відзнаки (ADR 0066, 0145), as `XBadges`: the Badge families, then the Badges' cards by family. */
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
  families: { paddingBottom: space[6] },
  count: { paddingBottom: space[4] },
});
