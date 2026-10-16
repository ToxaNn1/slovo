import type { EditionStrings } from '@slovo/contracts';
import type { CorrectionCardModel, WordCardModel } from '@slovo/core';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { DecorBackground, OrnamentDivider } from './DecorSlots';
import { useEdition } from './EditionProvider';
import { wordGrammarText } from './part-of-speech';
import { stressLabel } from './stress-label';
import { withAlpha, type ShareCardFormat } from './tokens';
import { useTokens } from './TokensProvider';

/**
 * A Share Card at the design's scale, in points, by format: the Story 324 wide
 * and 576 tall with its padding inside, a true 9:16 (design-system gap 17),
 * and the Square 300 on each side. Every size below is at this scale.
 */
export const SHARE_CARD = {
  story: { width: 324, height: 576 },
  square: { width: 300, height: 300 },
} as const satisfies Record<ShareCardFormat, { width: number; height: number }>;

/**
 * Each format's layout, from the design. The Story centres its content between
 * its insets with the overline on top and the watermark under it; the Square
 * starts at the top and keeps the overline and the watermark for its footer.
 */
const LAYOUT = {
  story: {
    padding: { horizontal: 34, vertical: 76 },
    /** The space between the blocks, and between a label and its form. */
    gap: 22,
    labelGap: 8,
    type: {
      overline: 10,
      headline: 54,
      partOfSpeech: 13,
      definition: 19,
      label: 13,
      nonStandard: 32,
      watermark: 11,
    },
  },
  square: {
    padding: { horizontal: 28, vertical: 30 },
    gap: 10,
    labelGap: 10,
    type: {
      overline: 10,
      headline: 34,
      partOfSpeech: 12,
      definition: 15,
      label: 12,
      nonStandard: 20,
      watermark: 10,
    },
  },
} as const;

/** The Story's watermark sits this far above the bottom edge, from the design. */
const STORY_WATERMARK_BOTTOM = 52;
/** The letter spacing of the overline and the watermark, as a share of their size, from the design. */
const OVERLINE_TRACKING = 0.22;
const STORY_WATERMARK_TRACKING = 0.32;
const FOOTER_TRACKING = 0.24;
/** Room above the headline's glyphs, so a Stress mark over a tall vowel isn't clipped. */
const HEADLINE_LINE_HEIGHT = 1.15;
const NON_STANDARD_LINE_HEIGHT = 1.2;
const DEFINITION_LINE_HEIGHT = 1.45;
const FOOTER_LINE_HEIGHT = 1.4;
/** The strike through the non-standard form, in the accent colour, as on the Correction card. */
const STRIKE_ALPHA = 0.5;

/** Text that doesn't fit shrinks by this share of its size at a time. */
const SHRINK_STEP = 0.05;
/** The headline shrinks to fit its line down to half its size, like on the Entry card, and then wraps. */
const HEADLINE_FLOOR = 0.5;
/** A measured height may round past the room by this much and still fit. */
const LAYOUT_SLACK = 0.5;

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
  /** The Entry's card, as the Core built it for the Feed. */
  card: WordCardModel | CorrectionCardModel;
  /** Whether it is today's Word of the Day, which the overline then says in place of the Category. */
  wordOfTheDay: boolean;
  /** The watermark: the Edition's display name. */
  watermark: string;
}

/**
 * The Share Card of an Entry in a format, `width` points wide, in the app's
 * current Theme, with no app chrome, over Decor slot 1 (designs
 * `share-card-word-story-dark` and `share-card-correction-square-light`).
 * A Word's shows the Lemma with Stress in the word family, the part of
 * speech with gender and registers, and the primary Definition; a
 * Correction's shows «Так часто кажуть» over the non-standard form struck
 * through, the divider with the Correction's arrow and «Українською краще»
 * over the main standard equivalent. The overline (today's Word of the Day, the Category or the
 * Correction Type) tops the Story and starts the Square's footer; the
 * watermark ends both. The card is laid out at its own size, so it is sharp
 * at any size, and its type keeps the design's proportions whatever the
 * reader's text size. A headline too wide for its line shrinks to a floor and
 * then wraps; text too tall for the card shrinks until it fits; nothing is cut.
 */
export function ShareCard(props: ShareCardContent & { format: ShareCardFormat; width: number }) {
  const id = props.card.kind === 'word' ? props.card.wordId : props.card.correctionId;
  // A new Entry or format measures from the design's sizes again.
  return <FittedCard key={`${id}-${props.format}`} {...props} />;
}

function FittedCard({
  card,
  wordOfTheDay,
  watermark,
  format,
  width,
}: ShareCardContent & { format: ShareCardFormat; width: number }) {
  const { colors, fontFamilies } = useTokens();
  const edition = useEdition();
  const { voice } = edition;
  const layout = LAYOUT[format];
  /** The design's points in this card's points. */
  const unit = width / SHARE_CARD[format].width;
  const [headlineScale, reportHeadline] = useShrinkToFit(HEADLINE_FLOOR);
  // No floor: shrinking is all that keeps a long text whole on the card.
  const [textScale, reportText] = useShrinkToFit(SHRINK_STEP);
  const [room, setRoom] = useState<number>();
  const [content, setContent] = useState<{ height: number; at: number }>();

  useEffect(() => {
    if (room !== undefined && content !== undefined) {
      reportText(content.at, content.height <= room + LAYOUT_SLACK);
    }
  }, [room, content, reportText]);

  const overline =
    card.kind === 'correction'
      ? edition.strings.correctionCard.correctionTypes[card.correctionType]
      : wordOfTheDay
        ? edition.strings.share.wordOfTheDay
        : edition.categoryName(card.categoryId);
  /** A size of the design's text, shrunk with the rest of the text. */
  const text = (size: number) => size * unit * textScale;
  const headline = (value: string) => (
    <Text
      allowFontScaling={false}
      onTextLayout={({ nativeEvent }) => {
        reportHeadline(headlineScale, nativeEvent.lines.length <= 1);
      }}
      style={[
        styles.headline,
        {
          fontSize: text(layout.type.headline) * headlineScale,
          lineHeight: text(layout.type.headline) * headlineScale * HEADLINE_LINE_HEIGHT,
          color: colors.ink,
          fontFamily: fontFamilies.word,
        },
      ]}
    >
      {value}
    </Text>
  );
  const blocks =
    card.kind === 'word' ? (
      <WordBlocks card={card} headline={headline} text={text} format={format} />
    ) : (
      <CorrectionBlocks
        card={card}
        headline={headline}
        text={text}
        format={format}
        dividerScale={unit}
      />
    );

  return (
    <View
      testID="share-card"
      accessible
      accessibilityLabel={[overline, ...accessibilityParts(card, edition.strings)]
        .filter((part) => part !== undefined)
        .join('. ')}
      {...voice}
      style={[
        styles.card,
        {
          width,
          height: SHARE_CARD[format].height * unit,
          paddingHorizontal: layout.padding.horizontal * unit,
          paddingVertical: layout.padding.vertical * unit,
          backgroundColor: colors.background,
        },
      ]}
    >
      <DecorBackground scale={unit} />
      <View
        onLayout={({ nativeEvent }) => {
          setRoom(nativeEvent.layout.height);
        }}
        style={format === 'story' ? styles.storyRoom : styles.squareRoom}
      >
        <View
          onLayout={({ nativeEvent }) => {
            setContent({ height: nativeEvent.layout.height, at: textScale });
          }}
          style={{ gap: text(layout.gap) }}
        >
          {format === 'story' && overline !== undefined && (
            <Text
              allowFontScaling={false}
              style={[
                styles.overline,
                {
                  fontSize: text(layout.type.overline),
                  letterSpacing: text(layout.type.overline) * OVERLINE_TRACKING,
                  color: colors.accent,
                  fontFamily: fontFamilies.ui,
                },
              ]}
            >
              {overline}
            </Text>
          )}
          {blocks}
        </View>
      </View>
      {format === 'story' ? (
        <Text
          allowFontScaling={false}
          style={[
            styles.storyWatermark,
            {
              bottom: STORY_WATERMARK_BOTTOM * unit,
              fontSize: layout.type.watermark * unit,
              letterSpacing: layout.type.watermark * unit * STORY_WATERMARK_TRACKING,
              color: colors.muted,
              fontFamily: fontFamilies.ui,
            },
          ]}
        >
          {watermark}
        </Text>
      ) : (
        <View style={[styles.footer, { marginTop: layout.gap * unit, gap: layout.gap * unit }]}>
          {[overline ?? '', watermark].map((part, index) => (
            <Text
              key={index}
              allowFontScaling={false}
              style={[
                styles.footerText,
                {
                  fontSize: layout.type.watermark * unit,
                  lineHeight: layout.type.watermark * unit * FOOTER_LINE_HEIGHT,
                  letterSpacing: layout.type.watermark * unit * FOOTER_TRACKING,
                  color: colors.muted,
                  fontFamily: fontFamilies.ui,
                },
              ]}
            >
              {part}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

/** What a block needs to draw its text at the card's scale. */
interface BlockProps {
  /** The headline (the Lemma or the main standard equivalent), shrinking to fit its line. */
  headline: (value: string) => ReactNode;
  /** A size of the design's text in this card's points. */
  text: (size: number) => number;
  format: ShareCardFormat;
}

/**
 * A Word's blocks: the Lemma with Stress, the part of speech with gender and
 * registers, and the primary Definition.
 */
function WordBlocks({ card, headline, text, format }: BlockProps & { card: WordCardModel }) {
  const { colors, fontFamilies } = useTokens();
  const { strings } = useEdition();
  const { type } = LAYOUT[format];
  return (
    <>
      {headline(card.lemma)}
      <Text
        allowFontScaling={false}
        style={[
          styles.partOfSpeech,
          { fontSize: text(type.partOfSpeech), color: colors.muted, fontFamily: fontFamilies.ui },
        ]}
      >
        {wordGrammarText(strings.wordCard, card, 'short')}
      </Text>
      <Text
        allowFontScaling={false}
        style={{
          fontSize: text(type.definition),
          lineHeight: text(type.definition) * DEFINITION_LINE_HEIGHT,
          color: colors.ink,
          fontFamily: fontFamilies.word,
        }}
      >
        {card.primaryDefinition}
      </Text>
    </>
  );
}

/**
 * A Correction's blocks: «Так часто кажуть» over the non-standard form struck
 * through, Decor slot 2 with the Correction's arrow, and «Українською краще»
 * over the main standard equivalent.
 */
function CorrectionBlocks({
  card,
  headline,
  text,
  format,
  dividerScale,
}: BlockProps & { card: CorrectionCardModel; dividerScale: number }) {
  const { colors, fontFamilies } = useTokens();
  const { strings } = useEdition();
  const { type, labelGap } = LAYOUT[format];
  const label = (value: string, color: string) => (
    <Text
      allowFontScaling={false}
      style={[styles.label, { fontSize: text(type.label), color, fontFamily: fontFamilies.ui }]}
    >
      {value}
    </Text>
  );
  return (
    <>
      <View style={{ gap: text(labelGap) }}>
        {label(strings.share.nonStandard, colors.muted)}
        <Text
          allowFontScaling={false}
          style={[
            styles.nonStandard,
            {
              fontSize: text(type.nonStandard),
              lineHeight: text(type.nonStandard) * NON_STANDARD_LINE_HEIGHT,
              color: colors.muted,
              fontFamily: fontFamilies.word,
              textDecorationColor: withAlpha(colors.accent, STRIKE_ALPHA),
            },
          ]}
        >
          {card.nonStandardForm}
        </Text>
      </View>
      <OrnamentDivider centre="arrow" scale={dividerScale} />
      <View style={{ gap: text(labelGap) }}>
        {label(strings.share.standard, colors.accent)}
        {headline(card.mainEquivalent)}
      </View>
    </>
  );
}

/** What VoiceOver reads of the card after its overline. */
function accessibilityParts(
  card: WordCardModel | CorrectionCardModel,
  strings: EditionStrings,
): (string | undefined)[] {
  if (card.kind === 'correction') {
    return [
      `${strings.share.nonStandard}: ${card.nonStandardForm}`,
      `${strings.share.standard}: ${card.mainEquivalent}`,
    ];
  }
  return [
    stressLabel(strings.wordCard, card.lemma, card.stressedVowels),
    wordGrammarText(strings.wordCard, card, 'full'),
    // Last, as it ends with its own full stop.
    card.primaryDefinition,
  ];
}

const styles = StyleSheet.create({
  card: { overflow: 'hidden' },
  storyRoom: { flex: 1, justifyContent: 'center' },
  squareRoom: { flex: 1, justifyContent: 'flex-start' },
  overline: { fontWeight: '700', textTransform: 'uppercase' },
  headline: { fontWeight: '500' },
  partOfSpeech: { fontWeight: '500' },
  label: { fontWeight: '500' },
  nonStandard: { fontWeight: '400', textDecorationLine: 'line-through' },
  storyWatermark: {
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    fontWeight: '600',
  },
  footer: { flexDirection: 'row', justifyContent: 'space-between' },
  footerText: { flexShrink: 1, fontWeight: '600', textTransform: 'uppercase' },
});
