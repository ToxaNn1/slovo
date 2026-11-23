import {
  BackLink,
  RarityTestQuestions,
  space,
  useTokens,
  type RarityTestQuestion,
  type RarityTestScreen as Screen,
} from '@slovo/ui';
import { useRouter } from 'expo-router';
import { useEffect, useEffectEvent, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useComposition } from '@/composition';
import { logError } from '@/diagnostics/log';
import { editionStrings } from '@/edition/edition';
import { rarityTestQuestionOf, useApplyRarityTest } from '@/mix/rarity-test';

/**
 * Settings › «Пройти тест ще раз»: the Rarity Test of the onboarding, drawn
 * afresh from the Mix. Its result overwrites the Rarity Range, from 1 (ADR 0156);
 * «ГОТОВО» goes back to Settings and «Перевірити рівень ще раз» draws a new
 * test at once. Going back before the last answer sets nothing. A draw with
 * no Word goes back at once.
 */
export default function RarityTestScreen() {
  const { colors } = useTokens();
  const { bottom } = useSafeAreaInsets();
  const router = useRouter();
  const { rarityTest } = useComposition();
  const applyRarityTest = useApplyRarityTest();
  const [words, setWords] = useState<readonly RarityTestQuestion[]>();
  /** How many times the test was started here, so «Перевірити рівень ще раз» draws anew. */
  const [round, setRound] = useState(0);
  /** Draws from the Rarity Test as it stands: a reopen gives a new one, which draws nothing until the next round. */
  const draw = useEffectEvent(() => rarityTest.draw());
  useEffect(() => {
    let open = true;
    draw()
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
  }, [router, round]);

  const back = () => {
    router.back();
  };
  const frame = ({ testID, footer, children }: Screen) => (
    <SafeAreaView
      testID={testID}
      edges={['top', 'left', 'right']}
      style={[styles.screen, { backgroundColor: colors.background }]}
    >
      <View style={styles.top}>
        <BackLink testID="rarity-test-back" label={editionStrings.settings.title} onPress={back} />
      </View>
      <ScrollView
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {children}
      </ScrollView>
      {/* The buttons sit on the home indicator's safe area, not a padding above it (XSettings t7). */}
      <View style={[styles.footer, { paddingBottom: Math.max(bottom, space[4]) }]}>{footer}</View>
    </SafeAreaView>
  );

  if (words === undefined)
    return frame({ testID: 'settings-rarity', footer: null, children: null });
  return (
    <RarityTestQuestions
      key={round}
      testID="settings-rarity"
      words={words}
      onApply={applyRarityTest}
      onDone={back}
      onAgain={() => {
        setWords(undefined);
        setRound((started) => started + 1);
      }}
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
    gap: space[4],
  },
});
