import {
  CategoriesRail,
  CorrectionTypesRail,
  CuratedCollectionsRail,
  dashboard,
  DashboardHero,
  FeedHeader,
  MoodCheckIn,
  PreviousWords,
  SplashOverlay,
  UndoToastProvider,
  useTokens,
} from '@slovo/ui';
import type { DashboardBlock } from '@slovo/core';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTonesOf } from '@/categories/categories';
import { useDashboardScreen } from '@/dashboard/dashboard';
import { edition, editionStrings } from '@/edition/edition';
import { todayText } from '@/feed/today-text';
import { StatsPillAndSheet } from '@/progress/progress';
import { useShown } from '@/shown-in-effect';

import FeedRoute from './feed';

/**
 * The home behind «Стрічка»: the Dashboard, which opens the Feed; with
 * `dashboard` off the Feed itself (ADR 0076).
 */
export default function HomeScreen() {
  return useShown().dashboard ? <DashboardScreen /> : <FeedRoute />;
}

/**
 * The Dashboard: the header, as the Feed's with the logo on an ink plate,
 * over the blocks of the local day, in display order, each with the board's
 * room above it. A Mood's reply comes as a toast.
 */
function DashboardScreen() {
  return (
    <UndoToastProvider>
      <DashboardBlocks />
    </UndoToastProvider>
  );
}

function DashboardBlocks() {
  const {
    blocks,
    today,
    reveal,
    toCard,
    chooseMood,
    openPreviousWord,
    openCorrectionType,
    openCuratedCollection,
    openCategories,
    openCategory,
    openCorrectionCategories,
  } = useDashboardScreen();
  const tonesOf = useTonesOf('quietRail');
  const { colors } = useTokens();
  const shown = useShown();
  // The daily splash from the logo plays over the Dashboard, then hands it back (ADR 0105).
  const [splash, setSplash] = useState(false);
  return (
    <SafeAreaView
      testID="dashboard"
      edges={['top']}
      style={[styles.screen, { backgroundColor: colors.background }]}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <FeedHeader
            logo="plate"
            wordmark={edition.displayName}
            today={todayText(today, editionStrings)}
            streak={<StatsPillAndSheet />}
            onLogo={
              shown.dailySplash
                ? {
                    label: editionStrings.dashboard.dailySplash,
                    onPress: () => {
                      setSplash(true);
                    },
                  }
                : undefined
            }
          />
        </View>
        {blocks.map((block) => (
          <View key={block.kind} style={blockStyles[block.kind]}>
            {blockOf(block)}
          </View>
        ))}
      </ScrollView>
      {splash && (
        <SplashOverlay
          pace="daily"
          wordmark={editionStrings.splash.wordmark}
          tagline={editionStrings.splash.tagline}
          onDone={() => {
            setSplash(false);
          }}
        />
      )}
    </SafeAreaView>
  );

  function blockOf(block: DashboardBlock) {
    switch (block.kind) {
      case 'wordOfTheDay':
        return (
          <DashboardHero
            hero={block.hero}
            sparks={shown.heroSparks}
            onReveal={reveal}
            onToCard={toCard}
          />
        );
      case 'mood':
        return <MoodCheckIn block={block} onChoose={chooseMood} />;
      case 'previousWords':
        return <PreviousWords block={block} onOpen={openPreviousWord} />;
      case 'correctionTypes':
        return (
          <CorrectionTypesRail
            tiles={block.tiles}
            categories={
              block.categories.length > 0
                ? { count: block.categories.length, onOpenAll: openCorrectionCategories }
                : undefined
            }
            onOpen={openCorrectionType}
          />
        );
      case 'categories':
        return (
          <CategoriesRail
            tiles={block.categories.map(({ id, displayName }) => ({ id, name: displayName }))}
            toneAt={tonesOf(block.categories)}
            onOpenAll={openCategories}
            onOpen={openCategory}
          />
        );
      case 'curatedCollections':
        return <CuratedCollectionsRail cards={block.cards} onOpen={openCuratedCollection} />;
    }
  }
}

const { header, side, heroMargin, blockTop, bottom } = dashboard;

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingBottom: bottom },
  header: { paddingTop: header.top, paddingHorizontal: header.side, paddingBottom: header.bottom },
});

/** The room around each block: the hero's margin, and above each other block the board's own. */
const blockStyles = StyleSheet.create({
  wordOfTheDay: { marginHorizontal: heroMargin },
  mood: { paddingTop: blockTop.mood, paddingHorizontal: side },
  previousWords: { paddingTop: blockTop.previousWords, paddingHorizontal: side },
  // A rail runs to the screen's edges and keeps the side room inside.
  categories: { paddingTop: blockTop.categories },
  curatedCollections: { paddingTop: blockTop.curatedCollections },
  correctionTypes: { paddingTop: blockTop.correctionTypes },
} satisfies Record<DashboardBlock['kind'], object>);
