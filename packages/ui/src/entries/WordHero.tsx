import { withoutStress, type LocalDate, type WordCardModel } from '@slovo/core';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '../primitives/Button';
import { Mascot } from '../primitives/Mascot';
import { useEdition } from '../providers/EditionProvider';
import type { TextSize } from '../providers/FontSizeProvider';
import { SchemeTokens, useSchemeColors, useTokens } from '../providers/TokensProvider';
import { typeStyle, wordHero } from '../tokens';
import { AccentGround } from './AccentGround';
import { CategoryChip } from './CategoryChip';
import { KickerRow } from './KickerRow';
import { OnAccentProvider } from './on-accent';
import { RevealDetail } from './reveal';
import { WordHeadline, WordSections } from './WordCard';
import { WordOfTheDayBadge } from './WordOfTheDayBadge';

/** A Lemma's first letter, in capitals, without its Stress mark. */
export function firstLetter(lemma: string): string {
  return (Array.from(withoutStress(lemma))[0] ?? '').toLocaleUpperCase();
}

/**
 * The red shout card of the Word of the Day in the Feed (XActions a1–a2),
 * under the halftone raster with a giant cream letter behind it. Closed,
 * while Self-check keeps the meaning, it shouts «Лови слово!» over the
 * Lemma, part of speech and Category, with the shouting Mascot and the
 * «Розкрити» button; the letter is «?». Open, the letter is the Lemma's
 * first and the meaning sits on a cream panel at the bottom, drawn in the
 * light Theme in both Themes.
 */
export function WordHero({
  card,
  day,
  compact,
  lemmaSize,
  concealed,
  onReveal,
  stressFalls,
  lemmaFont,
  onOpenCorrection,
  onOpenSynonymRow,
  onHistoryShown,
  corner,
}: {
  card: WordCardModel;
  day: LocalDate;
  compact: boolean;
  lemmaSize: TextSize;
  concealed: boolean;
  onReveal: () => void;
  stressFalls: boolean;
  lemmaFont: string | undefined;
  onOpenCorrection: ((correctionId: string) => void) | undefined;
  onOpenSynonymRow: ((synonymRowId: string) => void) | undefined;
  onHistoryShown: (() => void) | undefined;
  /** The corner actions, set in one row beside the card's kicker (`KickerRow`). */
  corner: ReactNode | undefined;
}) {
  const tokens = useTokens();
  const key = useSchemeColors('light');
  const { strings, voice } = useEdition();
  const headline = (
    <WordHeadline
      card={card}
      lemmaSize={lemmaSize}
      concealed={concealed}
      stressFalls={stressFalls}
      lemmaFont={lemmaFont}
      tabbed={false}
    />
  );
  return (
    <AccentGround
      id="word-hero"
      testID="word-hero"
      letter={concealed ? '?' : firstLetter(card.lemma)}
      letterRole="giantLetter"
      letterAt={concealed ? wordHero.letter.closed : wordHero.letter.open}
      style={styles.hero}
    >
      <KickerRow testID="word-kicker-row" corner={corner}>
        <WordOfTheDayBadge day={day} />
      </KickerRow>
      {concealed ? (
        <>
          <RevealDetail step={0}>
            <Text
              testID="word-hero-shout"
              {...voice}
              style={[typeStyle('heroShout', tokens), styles.shout, { color: key.ink }]}
            >
              {strings.wordOfTheDay.shout}
            </Text>
          </RevealDetail>
          {headline}
          {card.categoryName !== undefined && (
            <CategoryChip testID="word-category" name={card.categoryName} />
          )}
          <View style={styles.spacer} />
          <View style={styles.closedFoot}>
            <Mascot state="shouts" onRed width={wordHero.mascot} />
            <Button
              variant="onAccent"
              testID="word-reveal"
              label={strings.wordOfTheDay.reveal}
              onPress={onReveal}
            />
          </View>
        </>
      ) : (
        <>
          {headline}
          <View style={styles.spacer} />
          <RevealDetail step={1}>
            <SchemeTokens colorScheme="light">
              <OnAccentProvider value={false}>
                <View
                  testID="word-hero-panel"
                  style={[styles.panel, { backgroundColor: key.background }]}
                >
                  <WordSections
                    card={card}
                    compact={compact}
                    onOpenCorrection={onOpenCorrection}
                    onOpenSynonymRow={onOpenSynonymRow}
                    onHistoryShown={onHistoryShown}
                  />
                </View>
              </OnAccentProvider>
            </SchemeTokens>
          </RevealDetail>
        </>
      )}
    </AccentGround>
  );
}

const styles = StyleSheet.create({
  hero: {
    flexGrow: 1,
    minHeight: wordHero.minHeight,
    borderRadius: wordHero.radius,
    padding: wordHero.padding,
    gap: wordHero.gap,
  },
  shout: { maxWidth: wordHero.shoutWidth },
  spacer: { flexGrow: 1 },
  closedFoot: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  panel: {
    borderRadius: wordHero.panel.radius,
    padding: wordHero.panel.padding,
    gap: wordHero.panel.gap,
  },
});
