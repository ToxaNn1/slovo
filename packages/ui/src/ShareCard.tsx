import type { WordCardModel } from '@slovo/core';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { DecorBackground } from './DecorSlots';
import { useEdition } from './EditionProvider';
import { partOfSpeechText } from './part-of-speech';
import { stressLabel } from './stress-label';
import { useTokens } from './TokensProvider';

/**
 * The Story Share Card at the design's scale, in points: 324 wide and 576
 * tall with its padding inside, a true 9:16 (design-system gap 17). Every
 * size below is at this scale.
 */
export const STORY_CARD = { width: 324, height: 576 } as const;

/** The design's padding at the sides. */
const SIDE_PADDING = 34;
/** The watermark sits this far above the bottom edge, from the design. */
const WATERMARK_BOTTOM = 52;
/** The content keeps this far from the top and bottom edges, clear of the watermark. */
const CONTENT_INSET = 76;
/** The room the content has before it must shrink. */
const CONTENT_HEIGHT = STORY_CARD.height - 2 * CONTENT_INSET;
/** The space between the blocks, from the design. */
const GAP = 22;

/** The design's type sizes on the Story card. */
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

/** What a Share Card shows. */
export interface ShareCardContent {
  /** The Word's card, as the Core built it for the Feed. */
  card: WordCardModel;
  /** Whether it is today's Word of the Day, which the overline then says in place of the Category. */
  wordOfTheDay: boolean;
  /** The watermark at the bottom: the Edition's display name. */
  watermark: string;
}

/**
 * The Story Share Card of a Word (design `share-card-word-story-dark`),
 * `width` points wide and 9:16, in the app's current Theme, with no app
 * chrome: the overline, the Lemma with Stress in the word family, the part of
 * speech with gender and the primary Definition, centred over Decor slot 1,
 * and the watermark at the bottom. It is laid out at its own size, so it is
 * sharp at any size, and its type keeps the design's proportions whatever the
 * reader's text size. A Lemma too wide for its line shrinks to a floor and
 * then wraps; text too tall for the card shrinks until it fits; nothing is cut.
 */
export function ShareCard(props: ShareCardContent & { width: number }) {
  // A new Word measures from the design's sizes again.
  return <StoryCard key={props.card.wordId} {...props} />;
}

function StoryCard({ card, wordOfTheDay, watermark, width }: ShareCardContent & { width: number }) {
  const { colors, fontFamilies } = useTokens();
  const edition = useEdition();
  const { strings, voice } = edition;
  /** The design's points in this card's points. */
  const unit = width / STORY_CARD.width;
  const [lemmaScale, reportLemma] = useShrinkToFit(LEMMA_FLOOR);
  // No floor: shrinking is all that keeps a long text whole on the card.
  const [textScale, reportText] = useShrinkToFit(SHRINK_STEP);

  const overline = wordOfTheDay
    ? strings.share.wordOfTheDay
    : edition.categoryName(card.categoryId);
  const partOfSpeech = (form: 'short' | 'full') => partOfSpeechText(strings.wordCard, card, form);
  /** A size of the design's text, shrunk with the rest of the text. */
  const text = (size: number) => size * unit * textScale;
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
      style={[
        styles.card,
        {
          width,
          height: STORY_CARD.height * unit,
          paddingHorizontal: SIDE_PADDING * unit,
          backgroundColor: colors.background,
        },
      ]}
    >
      <DecorBackground scale={unit} />
      <View
        onLayout={({ nativeEvent }) => {
          reportText(textScale, nativeEvent.layout.height <= CONTENT_HEIGHT * unit);
        }}
        style={{ gap: text(GAP) }}
      >
        {overline !== undefined && (
          <Text
            allowFontScaling={false}
            style={[
              styles.overline,
              {
                fontSize: text(TYPE.overline),
                letterSpacing: text(TYPE.overline) * OVERLINE_TRACKING,
                color: colors.accent,
                fontFamily: fontFamilies.ui,
              },
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
              fontSize: text(TYPE.lemma) * lemmaScale,
              lineHeight: text(TYPE.lemma) * lemmaScale * LEMMA_LINE_HEIGHT,
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
            {
              fontSize: text(TYPE.partOfSpeech),
              color: colors.muted,
              fontFamily: fontFamilies.ui,
            },
          ]}
        >
          {partOfSpeech('short')}
        </Text>
        <Text
          allowFontScaling={false}
          style={{
            fontSize: text(TYPE.definition),
            lineHeight: text(TYPE.definition) * DEFINITION_LINE_HEIGHT,
            color: colors.ink,
            fontFamily: fontFamilies.word,
          }}
        >
          {card.primaryDefinition}
        </Text>
      </View>
      <Text
        allowFontScaling={false}
        style={[
          styles.watermark,
          {
            bottom: WATERMARK_BOTTOM * unit,
            fontSize: TYPE.watermark * unit,
            letterSpacing: TYPE.watermark * unit * WATERMARK_TRACKING,
            color: colors.muted,
            fontFamily: fontFamilies.ui,
          },
        ]}
      >
        {watermark}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { overflow: 'hidden', justifyContent: 'center' },
  overline: { fontWeight: '700', textTransform: 'uppercase' },
  lemma: { fontWeight: '500' },
  partOfSpeech: { fontWeight: '500' },
  watermark: { position: 'absolute', left: 0, right: 0, textAlign: 'center', fontWeight: '600' },
});
