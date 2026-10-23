import type { EditionStrings } from '@slovo/contracts';
import type {
  CorrectionCardModel,
  EntryFeedCard,
  IdiomCardModel,
  WordCardModel,
} from '@slovo/core';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { DecorBackground, OrnamentDivider, ShareCardFrame } from '../decor/DecorSlots';
import { useEdition } from '../providers/EditionProvider';
import { wordGrammarText } from '../entries/part-of-speech';
import { stressLabel } from '../entries/stress-label';
import { shareCardLayout, withAlpha, type ShareCardFormat } from '../tokens';
import { useTokens } from '../providers/TokensProvider';

/**
 * A Share Card at the design's scale, in points, by format: the Story 324 wide
 * and 576 tall with its padding inside, a true 9:16 (design-system gap 17),
 * and the Square 300 on each side. Every size below is at this scale.
 */
export const SHARE_CARD = {
  story: { width: 324, height: 576 },
  square: { width: 300, height: 300 },
} as const satisfies Record<ShareCardFormat, { width: number; height: number }>;

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
/** The strike through the non-standard form, in the accent colour at the design's 50%. */
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
  card: EntryFeedCard;
  /** Whether it is today's Word of the Day, which the overline then says in place of the Category. */
  wordOfTheDay: boolean;
  /** The watermark: the Edition's display name. */
  watermark: string;
}

/**
 * The Share Card of an Entry in a format, `width` points wide, in the app's
 * current Theme, with no app chrome, over Decor slot 1 in the frame of slot 5
 * (designs `share-card-word-story-dark` and `share-card-correction-square-light`). A
 * Word's shows the Lemma with Stress in the word family, the part of speech
 * with gender and registers, and the primary Definition; a Correction's shows
 * «Так часто кажуть» over the non-standard form struck through, the divider
 * with the Correction's arrow and «Українською краще» over the main standard
 * equivalent; an Idiom's shows its expression and its primary Definition, and
 * a place name's adds «Походження» over its etymology. The overline (today's
 * Word of the Day, the Category, the Correction Type or the chip of the Idiom
 * Type) tops the Story and starts the Square's footer; the watermark
 * ends both. The card is laid out at its own size, so it is sharp at any size,
 * and its type keeps the design's proportions whatever the reader's text size.
 * A headline too wide for its line shrinks to a floor and then wraps; text too
 * tall for the card shrinks until it fits; nothing is cut.
 */
export function ShareCard(props: ShareCardContent & { format: ShareCardFormat; width: number }) {
  // A new Entry or format measures from the design's sizes again.
  return <FittedCard key={`${props.card.entryId}-${props.format}`} {...props} />;
}

function FittedCard({
  card: { model },
  wordOfTheDay,
  watermark,
  format,
  width,
}: ShareCardContent & { format: ShareCardFormat; width: number }) {
  const { colors, fontFamilies } = useTokens();
  const edition = useEdition();
  const { voice } = edition;
  const layout = shareCardLayout[format];
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
    model.kind === 'correction'
      ? edition.strings.correctionCard.correctionTypes[model.correctionType]
      : model.kind === 'idiom'
        ? edition.strings.idiomCard.idiomTypes[model.idiomType]
        : wordOfTheDay
          ? edition.strings.share.wordOfTheDay
          : model.categoryName;
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
    model.kind === 'word' ? (
      <WordBlocks card={model} headline={headline} text={text} format={format} />
    ) : model.kind === 'idiom' ? (
      <IdiomBlocks card={model} headline={headline} text={text} format={format} />
    ) : (
      <CorrectionBlocks
        card={model}
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
      accessibilityLabel={sentences([overline, ...accessibilityParts(model, edition.strings)])}
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
      <ShareCardFrame format={format} scale={unit} inset={layout.frameInset * unit} />
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
      <CardEnd format={format} unit={unit} overline={overline} watermark={watermark} />
    </View>
  );
}

/**
 * The end of the card: the Story's watermark centred over its bottom edge, or
 * the Square's footer with the overline on the left and the watermark on the
 * right. Its type keeps the design's size whatever the text above shrinks to.
 */
function CardEnd({
  format,
  unit,
  overline,
  watermark,
}: {
  format: ShareCardFormat;
  /** The design's points in the card's points. */
  unit: number;
  overline: string | undefined;
  watermark: string;
}) {
  const { colors, fontFamilies } = useTokens();
  const { gap, type } = shareCardLayout[format];
  const size = type.watermark * unit;
  const ink = { color: colors.muted, fontFamily: fontFamilies.ui };
  if (format === 'story') {
    return (
      <Text
        allowFontScaling={false}
        style={[
          styles.storyWatermark,
          ink,
          {
            bottom: STORY_WATERMARK_BOTTOM * unit,
            fontSize: size,
            letterSpacing: size * STORY_WATERMARK_TRACKING,
          },
        ]}
      >
        {watermark}
      </Text>
    );
  }
  return (
    <View style={[styles.footer, { marginTop: gap * unit, gap: gap * unit }]}>
      {[overline ?? '', watermark].map((part, index) => (
        <Text
          key={index}
          allowFontScaling={false}
          style={[
            styles.footerText,
            ink,
            {
              fontSize: size,
              lineHeight: size * FOOTER_LINE_HEIGHT,
              letterSpacing: size * FOOTER_TRACKING,
            },
          ]}
        >
          {part}
        </Text>
      ))}
    </View>
  );
}

/** What a block needs to draw its text at the card's scale. */
interface BlockProps {
  /** The headline (the Lemma, the main standard equivalent or the expression), shrinking to fit its line. */
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
  const { type } = shareCardLayout[format];
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
      <Definition text={text} size={type.definition} value={card.primaryDefinition} />
    </>
  );
}

/**
 * An Idiom's blocks: the expression and the primary Definition, and a place
 * name's «Походження» over its etymology, the story of its name.
 */
function IdiomBlocks({ card, headline, text, format }: BlockProps & { card: IdiomCardModel }) {
  const { colors, fontFamilies } = useTokens();
  const { strings } = useEdition();
  const { type, labelGap } = shareCardLayout[format];
  return (
    <>
      {headline(card.expression)}
      <Definition text={text} size={type.definition} value={card.primaryDefinition} />
      {card.idiomType === 'placeName' && card.etymology !== undefined && (
        <View style={{ gap: text(labelGap) }}>
          <Text
            allowFontScaling={false}
            style={[
              styles.label,
              { fontSize: text(type.label), color: colors.accent, fontFamily: fontFamilies.ui },
            ]}
          >
            {strings.idiomCard.etymology}
          </Text>
          <Text
            allowFontScaling={false}
            style={{
              fontSize: text(type.etymology),
              lineHeight: text(type.etymology) * DEFINITION_LINE_HEIGHT,
              color: colors.inkSecondary,
              fontFamily: fontFamilies.ui,
            }}
          >
            {card.etymology}
          </Text>
        </View>
      )}
    </>
  );
}

/** The primary Definition of a Word or an Idiom. */
function Definition({
  text,
  size,
  value,
}: Pick<BlockProps, 'text'> & { size: number; value: string }) {
  const { colors, fontFamilies } = useTokens();
  return (
    <Text
      allowFontScaling={false}
      style={{
        fontSize: text(size),
        lineHeight: text(size) * DEFINITION_LINE_HEIGHT,
        color: colors.ink,
        fontFamily: fontFamilies.word,
      }}
    >
      {value}
    </Text>
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
  const { type, labelGap } = shareCardLayout[format];
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

/**
 * The parts VoiceOver reads, one sentence each: a part ending in its own full
 * stop takes no other.
 */
function sentences(parts: (string | undefined)[]): string {
  return parts
    .filter((part) => part !== undefined)
    .reduce(
      (label, part) =>
        label === '' ? part : `${label}${/[.!?…]$/.test(label) ? ' ' : '. '}${part}`,
      '',
    );
}

/** What VoiceOver reads of the card after its overline. */
function accessibilityParts(
  card: EntryFeedCard['model'],
  strings: EditionStrings,
): (string | undefined)[] {
  if (card.kind === 'idiom') {
    return [
      card.expression,
      card.primaryDefinition,
      card.idiomType === 'placeName' && card.etymology !== undefined
        ? `${strings.idiomCard.etymology}: ${card.etymology}`
        : undefined,
    ];
  }
  if (card.kind === 'correction') {
    return [
      `${strings.share.nonStandard}: ${stressLabel(strings.wordCard, card.nonStandardForm, card.nonStandardStressedVowels)}`,
      `${strings.share.standard}: ${stressLabel(strings.wordCard, card.mainEquivalent, card.mainEquivalentStressedVowels)}`,
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
