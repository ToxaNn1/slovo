import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Icon } from '../primitives/Icon';
import { PressedTile } from '../primitives/PressedTile';
import { useEdition } from '../providers/EditionProvider';
import { useLemmaSize } from '../providers/FontSizeProvider';
import { useSchemeColors, useTokens } from '../providers/TokensProvider';
import { entryPanel, iconButton, space, swipeStampLayout, wedges, wordCardSide } from '../tokens';
import { AccentGround } from './AccentGround';
import { SwipeMarks, type EntrySwipe } from './SwipeMarks';
import type { EntryCardProps } from './EntryCard';
import { CorrectionCardBody } from './CorrectionCard';
import { EntryPanelHeadline, headlineOf, type OtherKindCard } from './EntryPanelHeadline';
import { IdiomCardBody } from './IdiomCard';
import { SynonymRowCardBody } from './SynonymRowCard';
import { TipCardBody } from './TipCard';
import { EntryReveal } from './reveal';
import { WordHeadline } from './WordCard';
import { WordTabs } from './WordTabs';
import { firstLetter } from './WordHero';
import { WordOfTheDayBadge } from './WordOfTheDayBadge';

/**
 * Entry details (XActions a4): the red panel on top, cut by a slanted bottom
 * edge, under the halftone raster, with the ink back tile. A Word's panel
 * carries the giant first letter of its Lemma, the Word of the Day's kicker
 * when it is one, the Lemma, part of speech and the Pronunciation button.
 * Every other kind is headed the same way (owner 15.11, ADR 0142): the giant first letter of its headline, its expression, dominant,
 * title or struck form, and the name of its kind under it. The meaning
 * follows on the screen's ground, with no card frame, and the corner sits at
 * the panel's top right. It never conceals the meaning.
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
  sourceTab = false,
  tipExceptions = false,
}: Omit<EntryCardProps, 'selfCheck' | 'wordOfTheDayFont' | 'tabs'> & {
  /** The name of the screen the back tile returns to, which VoiceOver reads. */
  back: string;
  onBack: () => void;
  /** The status bar's height: the panel runs under it. */
  topInset: number;
  /** The home indicator's height: the tabbed card's tab bar keeps above it. */
  bottomInset: number;
}) {
  const lemmaSize = useLemmaSize();
  const swipe = slots?.swipe;
  // The tab bar stands at the screen's foot (owner 08.11): under it only the room
  // the swipe's stamp keeps, which takes in the home indicator.
  const stampRoom = swipe ? swipeStampLayout.room : 0;
  const foot = Math.max(0, bottomInset - stampRoom);
  // The frame runs a little past the screen's foot, into the room under the bar, so
  // the bar stands lower (owner 14.11).
  const drop = Math.min(entryPanel.tabBarDrop, Math.max(bottomInset, stampRoom));
  const body = (
    <Swiped swipe={swipe} correction={card.kind === 'correction'} fill>
      <AccentGround
        id="entry-panel"
        testID="entry-panel"
        letter={
          card.kind === 'word' ? firstLetter(card.model.lemma) : firstLetter(headlineOf(card))
        }
        letterRole="panelLetter"
        letterAt={entryPanel.letter}
        points={wedges.panel}
        letterStopsAt={entryPanel.cutAt}
        style={[styles.panel, { paddingTop: topInset + space[3] }]}
      >
        <BackTile label={back} onPress={onBack} />
        {slots !== undefined && (
          <View
            style={[styles.corner, { top: topInset + space[3] }]}
            testID={`${card.kind}-corner`}
          >
            {slots.corner}
          </View>
        )}
        <View style={styles.panelText}>
          {card.kind !== 'word' ? (
            <EntryPanelHeadline card={card} />
          ) : (
            <>
              {card.wordOfTheDay !== undefined && <WordOfTheDayBadge day={card.wordOfTheDay} />}
              <WordHeadline
                card={card.model}
                lemmaSize={lemmaSize}
                concealed={false}
                stressFalls={stressFalls}
                lemmaFont={undefined}
                tabbed={false}
              />
            </>
          )}
        </View>
      </AccentGround>
      {card.kind !== 'word' ? (
        <View testID="entry-body" style={[styles.body, styles.tabbed]}>
          <OtherKindBody
            card={card}
            onOpenWord={onOpenWord}
            sourceTab={sourceTab}
            tipExceptions={tipExceptions}
          />
        </View>
      ) : (
        <View testID="word-card" style={[styles.body, styles.tabbed]}>
          <WordTabs
            card={card.model}
            onOpenCorrection={onOpenCorrection}
            onOpenSynonymRow={onOpenSynonymRow}
            onHistoryShown={onWordHistoryShown}
            sources={sourceTab ? card.model.sourceNames : undefined}
          />
        </View>
      )}
    </Swiped>
  );
  return (
    <EntryReveal>
      {/* The tabbed card is a fixed frame the rest of the screen's height: nothing around it
      scrolls, only an opened tab inside it (ADR 0091, ADR 0113). */}
      <View
        testID="entry-frame"
        style={[styles.scroll, { paddingBottom: foot }, drop > 0 && { marginBottom: -drop }]}
      >
        {body}
      </View>
    </EntryReveal>
  );
}

/** The meaning of an Entry of another kind under the panel that heads it, as its card's body without the head. */
function OtherKindBody({
  card,
  onOpenWord,
  sourceTab,
  tipExceptions,
}: {
  card: OtherKindCard;
  onOpenWord: ((wordId: string) => void) | undefined;
  sourceTab: boolean;
  tipExceptions: boolean;
}) {
  const lemmaSize = useLemmaSize();
  const shared = {
    lemmaSize,
    concealed: false,
    corner: undefined,
    tabs: true,
    sourceTab,
    headless: true,
  };
  switch (card.kind) {
    case 'correction':
      return <CorrectionCardBody card={card.model} {...shared} />;
    case 'idiom':
      return <IdiomCardBody card={card.model} {...shared} />;
    case 'synonymRow':
      return <SynonymRowCardBody card={card.model} onOpenWord={onOpenWord} {...shared} />;
    case 'tip':
      return <TipCardBody card={card.model} exceptionsTab={tipExceptions} {...shared} />;
  }
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
  /** The tabbed card fills the rest of the screen (ADR 0091), so the swipe grows to it. */
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
  // A tabbed Word fills the rest of the screen, its tab bar at the foot (ADR 0091).
  tabbed: { flexGrow: 1, paddingBottom: 0 },
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
});
