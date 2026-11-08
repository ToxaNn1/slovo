import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Icon } from '../primitives/Icon';
import { PressedTile } from '../primitives/PressedTile';
import { useEdition } from '../providers/EditionProvider';
import { useCompactLayout, useLemmaSize } from '../providers/FontSizeProvider';
import { useSchemeColors, useTokens } from '../providers/TokensProvider';
import { entryPanel, iconButton, space, wedges, wordCardSide } from '../tokens';
import { AccentGround } from './AccentGround';
import { SwipeMarks, type EntrySwipe } from './SwipeMarks';
import { EntryCard, type EntryCardProps } from './EntryCard';
import { EntryReveal, RevealDetail } from './reveal';
import { WordHeadline, WordSections } from './WordCard';
import { WordTabs } from './WordTabs';
import { firstLetter } from './WordHero';
import { WordOfTheDayBadge } from './WordOfTheDayBadge';

/**
 * Entry details (XActions a4): the red panel on top, cut by a slanted bottom
 * edge, under the halftone raster, with the ink back tile. A Word's panel
 * carries the giant first letter of its Lemma, the Word of the Day's kicker
 * when it is one, the Lemma, part of speech and the Pronunciation button;
 * its meaning follows on the screen's ground and its action row is docked at
 * the screen's foot, or while marks are swiped its corner sits at the
 * panel's top right. Any other kind keeps its Entry card, with its row or
 * corner, under the panel. It never conceals the meaning.
 */
export function EntryDetails({
  card,
  back,
  onBack,
  topInset,
  bottomInset,
  stressFalls = false,
  onOpenCorrection,
  onOpenWord,
  onOpenSynonymRow,
  onWordHistoryShown,
  slots,
  tabs = false,
}: Omit<EntryCardProps, 'selfCheck' | 'wordOfTheDayFont'> & {
  /** The name of the screen the back tile returns to, which VoiceOver reads. */
  back: string;
  onBack: () => void;
  /** The status bar's height: the panel runs under it. */
  topInset: number;
  /** The home indicator's height: a Word's dock keeps its buttons above it. */
  bottomInset: number;
}) {
  const { colors } = useTokens();
  const lemmaSize = useLemmaSize();
  const compact = useCompactLayout();
  const word = card.kind === 'word' ? card : undefined;
  const swipe = slots?.slot === 'corner' ? slots.swipe : undefined;
  return (
    <EntryReveal>
      <ScrollView
        testID="entry-scroll"
        style={styles.scroll}
        // The tabs fill the rest of the screen under the panel (ADR 0088).
        contentContainerStyle={tabs ? styles.fill : undefined}
        // The sheet of the action row is a child in React's tree, so a tap in its
        // name field must not be swallowed to put the keyboard away.
        keyboardShouldPersistTaps="handled"
      >
        <Swiped swipe={swipe} correction={card.kind === 'correction'} fill={tabs}>
          <AccentGround
            id="entry-panel"
            testID="entry-panel"
            letter={word === undefined ? '' : firstLetter(word.model.lemma)}
            letterRole="panelLetter"
            letterAt={entryPanel.letter}
            points={wedges.panel}
            letterStopsAt={entryPanel.cutAt}
            style={[styles.panel, { paddingTop: topInset + space[3] }]}
          >
            <BackTile label={back} onPress={onBack} />
            {word !== undefined && slots?.slot === 'corner' && (
              <View style={[styles.corner, { top: topInset + space[3] }]} testID="word-corner">
                {slots.corner}
              </View>
            )}
            {word !== undefined && (
              <View style={styles.panelText}>
                {word.wordOfTheDay !== undefined && <WordOfTheDayBadge day={word.wordOfTheDay} />}
                <WordHeadline
                  card={word.model}
                  lemmaSize={lemmaSize}
                  concealed={false}
                  stressFalls={stressFalls}
                  lemmaFont={undefined}
                />
              </View>
            )}
          </AccentGround>
          {word === undefined ? (
            <View style={[styles.otherKind, tabs && styles.fill]}>
              <EntryCard
                card={card}
                onOpenCorrection={onOpenCorrection}
                onOpenWord={onOpenWord}
                onOpenSynonymRow={onOpenSynonymRow}
                onWordHistoryShown={onWordHistoryShown}
                // The swipes take the whole of Entry details, so the card keeps only its corner.
                slots={slots?.slot === 'corner' ? { ...slots, swipe: undefined } : slots}
                stressFalls={stressFalls}
                tabs={tabs}
              />
            </View>
          ) : (
            <View testID="word-card" style={[styles.body, tabs && styles.fill]}>
              {tabs ? (
                <WordTabs
                  card={word.model}
                  onOpenCorrection={onOpenCorrection}
                  onOpenSynonymRow={onOpenSynonymRow}
                  onHistoryShown={onWordHistoryShown}
                />
              ) : (
                <WordSections
                  card={word.model}
                  compact={compact}
                  onOpenCorrection={onOpenCorrection}
                  onOpenSynonymRow={onOpenSynonymRow}
                  onHistoryShown={onWordHistoryShown}
                />
              )}
            </View>
          )}
        </Swiped>
      </ScrollView>
      {word !== undefined && slots?.slot === 'actions' && (
        <View
          style={[
            styles.dock,
            {
              paddingBottom: Math.max(bottomInset, space[3]),
              backgroundColor: colors.background,
              borderTopColor: colors.line,
            },
          ]}
        >
          <RevealDetail step={3} testID="word-actions">
            {slots.actions}
          </RevealDetail>
        </View>
      )}
    </EntryReveal>
  );
}

/**
 * The whole content of Entry details, panel and meaning, under the side
 * swipes that set the Knowledge Mark when the screen has them (ADR 0077).
 * Entry details never conceals the meaning, so the swipes are always on.
 */
function Swiped({
  swipe,
  correction,
  fill,
  children,
}: {
  swipe: EntrySwipe | undefined;
  correction: boolean;
  /** The tabbed card fills the rest of the screen (ADR 0088), so the swipe grows to it. */
  fill: boolean;
  children: ReactNode;
}) {
  if (swipe === undefined) return <>{children}</>;
  return (
    <SwipeMarks swipe={swipe} concealed={false} correction={correction} fill={fill}>
      {children}
    </SwipeMarks>
  );
}

/** The ink tile with the cream chevron that goes back, in the panel's top left corner. */
function BackTile({ label, onPress }: { label: string; onPress: () => void }) {
  const { radii } = useTokens();
  const cream = useSchemeColors('light').background;
  const { voice } = useEdition();
  return (
    <View style={styles.backTile} {...voice}>
      <PressedTile
        tone="ink"
        radius={radii.tile}
        testID="entry-screen-back"
        accessibilityLabel={label}
        onPress={onPress}
        faceStyle={styles.backFace}
      >
        <Icon name="back" size={iconButton.icon} color={cream} />
      </PressedTile>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  fill: { flexGrow: 1 },
  // A Word's action row stays at the screen's foot over the scrolling text (XActions a4).
  dock: {
    paddingHorizontal: space[3],
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  panel: {
    paddingHorizontal: space[4],
    paddingBottom: entryPanel.paddingBottom,
    gap: entryPanel.kickerGap,
  },
  panelText: { paddingHorizontal: space[1], gap: space[3] },
  backTile: { alignSelf: 'flex-start' },
  // Level with the back tile, over the panel's top right (XSwipe).
  corner: { position: 'absolute', right: space[4] },
  backFace: {
    width: iconButton.side,
    height: iconButton.side,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    paddingHorizontal: wordCardSide - space[1],
    paddingTop: space[1],
    paddingBottom: space[6],
    gap: entryPanel.bodyGap,
  },
  otherKind: { paddingHorizontal: space[6], paddingBottom: space[6] },
});
