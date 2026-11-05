import {
  CorrectionTypesRail,
  DashboardHero,
  MoodCheckIn,
  PreviousWords,
  space,
  useTokens,
} from '@slovo/ui';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useDashboardScreen } from '@/dashboard/dashboard';
import { useShown } from '@/shown-in-effect';

import FeedRoute from './feed';

/**
 * The home behind «Стрічка»: the Dashboard, which opens the Feed; with
 * `dashboard` off the Feed itself (ADR 0076).
 */
export default function HomeScreen() {
  return useShown().dashboard ? <DashboardScreen /> : <FeedRoute />;
}

/** The Dashboard's blocks of the local day, in display order. */
function DashboardScreen() {
  const { blocks, reveal, toCard, chooseMood, skipMood, openPreviousWord, openCorrectionType } =
    useDashboardScreen();
  const { colors } = useTokens();
  return (
    <SafeAreaView
      testID="dashboard"
      edges={['top']}
      style={[styles.screen, { backgroundColor: colors.background }]}
    >
      <ScrollView contentContainerStyle={styles.content}>
        {blocks.map((block) => {
          switch (block.kind) {
            case 'wordOfTheDay':
              return (
                <DashboardHero
                  key={block.kind}
                  hero={block.hero}
                  onReveal={reveal}
                  onToCard={toCard}
                />
              );
            case 'mood':
              return (
                <MoodCheckIn
                  key={block.kind}
                  block={block}
                  onChoose={chooseMood}
                  onSkip={skipMood}
                />
              );
            case 'previousWords':
              return <PreviousWords key={block.kind} block={block} onOpen={openPreviousWord} />;
            case 'correctionTypes':
              return (
                <CorrectionTypesRail
                  key={block.kind}
                  tiles={block.tiles}
                  onOpen={openCorrectionType}
                />
              );
          }
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: space[3], gap: space[4] },
});
