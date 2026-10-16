import type { WordCardModel } from '@slovo/core';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { DecorBackground } from './DecorSlots';
import { useEdition } from './EditionProvider';
import { partOfSpeechText } from './part-of-speech';
import { stressLabel } from './stress-label';
import { useTokens } from './TokensProvider';

/**
 * The Story Share Card's size in points, a true 9:16 (design-system gap 17):
 * the design's 324 wide and 576 tall, padding included. Its image is drawn
 * from this size at 1080×1920.
 */
export const STORY_CARD = { width: 324, height: 576 } as const;

/** The design's padding at the sides. */
const SIDE_PADDING = 34;
/** The watermark's baseline box sits this far above the bottom edge, from the design. */
const WATERMARK_BOTTOM = 52;
/** The content keeps this far from the top and bottom edges, clear of the watermark. */
const CONTENT_INSET = 76;
/** The room the content has before it must shrink. */
const CONTENT_HEIGHT = STORY_CARD.height - 2 * CONTENT_INSET;
/** The space between the blocks, from the design. */
const GAP = 22;

/** The design's type sizes on the Story card, in points. */
const TYPE = { overline: 10, lemma: 54, partOfSpeech: 13, definition: 19, watermark: 11 } as const;
/** The letter spacing of the overline and the watermark, as a share of their size, from the design. */
const OVERLINE_TRACKING = 0.22;
const WATERMARK_TRACKING = 0.32;
/** Room above the Lemma's glyphs, so the Stress mark over a tall vowel isn't clipped. */
const LEMMA_LINE_HEIGHT = 1.15;
const DEFINITION_LINE_HEIGHT = 1.45;

/** Text that doesn't fit shrinks by this share of its size at a time. */
const SHRINK_STEP = 0.05;
/** The Lemma shrinks to fit its line down to half its size, like on the Entry card, and then wraps. */
const LEMMA_FLOOR = 0.5;
/** All the text shrinks to fit the card's height down to this share of its size, and then runs on. */
const TEXT_FLOOR = 0.6;

/**
 * A share of the text's size that steps down while what it draws doesn't fit,
 * until `floor`. Each report names the scale it was measured at, so a stale
 * measurement never steps twice.
 */
function useShrinkToFit(floor: number): [number, (measuredAt: number, fits: boolean) => void] {
  const [scale, setScale] = useState(1);
  const report = useCallback(
    (measuredAt: number, fits: boolean) => {
      if (fits) return;
      setScale((current) =>
        current === measuredAt && current > floor
          ? Math.max(floor, Math.round((current - SHRINK_STEP) * 100) / 100)
          : current,
      );
    },
    [floor],
  );
  return [scale, report];
}

export interface ShareCardProps {
  /** The Word's card, as the Core built it for the Feed. */
  card: WordCardModel;
  /** Whether it is today's Word of the Day, which the overline then says in place of the Category. */
  wordOfTheDay: boolean;
  /** The watermark at the bottom: the Edition's display name. */
  watermark: string;
}

/**
 * The Story Share Card of a Word (design `share-card-word-story-dark`), at
 * `STORY_CARD`'s size in the app's current Theme, with no app chrome: the
 * overline, the Lemma with Stress in the word family, the part of speech
 * with gender and the primary Definition, centred over Decor slot 1, and the
 * watermark at the bottom. Its type keeps the design's sizes whatever the
 * reader's text size. A Lemma too wide for its line, and text too tall for
 * the card, shrink to a floor and then wrap; nothing is cut. VoiceOver reads
 * it as the Word's text.
 */
export function ShareCard(props: ShareCardProps) {
  // A new Word measures from the design's sizes again.
  return <StoryCard key={props.card.wordId} {...props} />;
}

function StoryCard({ card, wordOfTheDay, watermark }: ShareCardProps) {
  const { colors, fontFamilies } = useTokens();
  const edition = useEdition();
  const { voice } = edition;
  const strings = edition.strings;
  const [lemmaScale, reportLemma] = useShrinkToFit(LEMMA_FLOOR);
  const [textScale, reportText] = useShrinkToFit(TEXT_FLOOR);

  const overline = wordOfTheDay
    ? strings.share.wordOfTheDay
    : edition.categoryName(card.categoryId);
  const partOfSpeech = (form: 'short' | 'full') => partOfSpeechText(strings.wordCard, card, form);
  const sized = (size: number, lineHeight?: number) => ({
    fontSize: size * textScale,
    lineHeight: lineHeight === undefined ? undefined : size * textScale * lineHeight,
  });
  const label = [
    overline,
    stressLabel(strings.wordCard, card.lemma, card.stressedVowels),
    partOfSpeech('full'),
    // Last, as it ends with its own full stop.
    card.primaryDefinition,
  ]
    .filter((part) => part !== undefined)
    .join('. ');

  return (
    <View
      testID="share-card"
      accessible
      accessibilityLabel={label}
      {...voice}
      style={[styles.card, { backgroundColor: colors.background }]}
    >
      <DecorBackground />
      <View
        onLayout={({ nativeEvent }) => {
          reportText(textScale, nativeEvent.layout.height <= CONTENT_HEIGHT);
        }}
        style={{ gap: GAP * textScale }}
      >
        {overline !== undefined && (
          <Text
            allowFontScaling={false}
            style={[
              styles.overline,
              sized(TYPE.overline),
              { letterSpacing: TYPE.overline * textScale * OVERLINE_TRACKING },
              { color: colors.accent, fontFamily: fontFamilies.ui },
            ]}
          >
            {overline}
          </Text>
        )}
        <Text
          allowFontScaling={false}
          onTextLayout={({ nativeEvent }) => {
            reportLemma(lemmaScale, nativeEvent.lines.length <= 1);
          }}
          style={[
            styles.lemma,
            {
              fontSize: TYPE.lemma * lemmaScale * textScale,
              lineHeight: TYPE.lemma * lemmaScale * textScale * LEMMA_LINE_HEIGHT,
              color: colors.ink,
              fontFamily: fontFamilies.word,
            },
          ]}
        >
          {card.lemma}
        </Text>
        <Text
          allowFontScaling={false}
          style={[
            styles.partOfSpeech,
            sized(TYPE.partOfSpeech),
            { color: colors.muted, fontFamily: fontFamilies.ui },
          ]}
        >
          {partOfSpeech('short')}
        </Text>
        <Text
          allowFontScaling={false}
          style={[
            sized(TYPE.definition, DEFINITION_LINE_HEIGHT),
            { color: colors.ink, fontFamily: fontFamilies.word },
          ]}
        >
          {card.primaryDefinition}
        </Text>
      </View>
      <Text
        allowFontScaling={false}
        style={[styles.watermark, { color: colors.muted, fontFamily: fontFamilies.ui }]}
      >
        {watermark}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    ...STORY_CARD,
    overflow: 'hidden',
    justifyContent: 'center',
    paddingHorizontal: SIDE_PADDING,
  },
  overline: { fontWeight: '700', textTransform: 'uppercase' },
  lemma: { fontWeight: '500' },
  partOfSpeech: { fontWeight: '500' },
  watermark: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: WATERMARK_BOTTOM,
    textAlign: 'center',
    fontSize: TYPE.watermark,
    fontWeight: '600',
    letterSpacing: TYPE.watermark * WATERMARK_TRACKING,
  },
});
