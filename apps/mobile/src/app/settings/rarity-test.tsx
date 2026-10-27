import {
  BackLink,
  RarityTestQuestions,
  space,
  useTokens,
  type RarityTestQuestion,
  type RarityTestScreen as Screen,
} from '@slovo/ui';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useComposition } from '@/composition';
import { logError } from '@/diagnostics/log';
import { editionStrings } from '@/edition/edition';
import { rarityTestQuestionOf, useApplyRarityTest } from '@/mix/rarity-test';

/**
 * Settings › «Пройти тест ще раз»: the Rarity Test of the onboarding, drawn
 * afresh from the Mix. Its result overwrites the Rarity Floor (ADR 0054), and
 * «Далі» goes back to Settings; going back before the last answer sets
 * nothing. A draw with no Word goes back at once.
 */
export default function RarityTestScreen() {
  const { colors } = useTokens();
  const router = useRouter();
  const { rarityTest } = useComposition();
  const applyRarityTest = useApplyRarityTest();
  const [words, setWords] = useState<readonly RarityTestQuestion[]>();
  useEffect(() => {
    let open = true;
    rarityTest
      .draw()
      .then((drawn) => {
        if (!open) return;
        if (drawn.length === 0) router.back();
        else setWords(drawn.map(rarityTestQuestionOf));
      })
      .catch((error: unknown) => {
        logError('Could not draw the Rarity Test', error);
        if (open) router.back();
      });
    return () => {
      open = false;
    };
  }, [rarityTest, router]);

  const back = () => {
    router.back();
  };
  const frame = ({ testID, footer, children }: Screen) => (
    <SafeAreaView testID={testID} style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={styles.top}>
        <BackLink testID="rarity-test-back" label={editionStrings.settings.title} onPress={back} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>{children}</ScrollView>
      <View style={styles.footer}>{footer}</View>
    </SafeAreaView>
  );

  if (words === undefined)
    return frame({ testID: 'settings-rarity', footer: null, children: null });
  return (
    <RarityTestQuestions
      testID="settings-rarity"
      words={words}
      onApply={applyRarityTest}
      onDone={back}
      frame={frame}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  top: { paddingHorizontal: space[5], paddingTop: space[2] },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    gap: space[3],
    paddingHorizontal: space[5],
    paddingVertical: space[6],
  },
  footer: {
    paddingHorizontal: space[5],
    paddingTop: space[3],
    paddingBottom: space[4],
    gap: space[5],
  },
});
