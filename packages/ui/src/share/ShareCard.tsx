import type { BadgeShape, BadgeTone, MascotState } from '@slovo/contracts';
import type { ShareCardBody, ShareCardContent } from '@slovo/core';
import { useCallback, useEffect, useId, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, Pattern, Polygon, Rect } from 'react-native-svg';

import { Mascot } from '../primitives/Mascot';
import { BadgeMark } from '../progress/BadgeMark';
import { useEdition } from '../providers/EditionProvider';
import { useTokens } from '../providers/TokensProvider';
import {
  badgeShareMark,
  halftone,
  roleAt,
  shareCardDrawing,
  shareCardLayout,
  wedges,
  withAlpha,
  typeStyle,
  type ShareCardFormat,
  type TypeRole,
  type Wedge,
} from '../tokens';

/**
 * A Share Card at the design's scale, in points, by format: the Story 270
 * wide and 480 tall, a true 9:16, and the Square 300 on each side. Every
 * size below is at this scale.
 */
export const SHARE_CARD = {
  story: { width: 270, height: 480 },
  square: { width: 300, height: 300 },
} as const satisfies Record<ShareCardFormat, { width: number; height: number }>;

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

/** What the Share Card draws: the content the Core built, and the watermark. */
export interface ShareCardProps {
  /** What the card shows, as the Core built it (ADR 0017). */
  content: ShareCardContent;
  /** The watermark: the Edition's display name. */
  watermark: string;
  /** The Badge of a Badge's card: its poster mark over the title (board 10.7). */
  badge?: { shape: BadgeShape; tone: BadgeTone; symbol: string } | undefined;
}

/** The colours of the card in the current Theme: red in the light one, the dark ground in the dark one. */
interface Paint {
  ground: string;
  ink: string;
  /** The brand wedge, the labels and the filled crossword cells. */
  mark: string;
  giant: string;
  dot: string;
  chip: string;
  closedCell: string;
  footer: string;
  onFooter: string;
  onRed: boolean;
}

function usePaint(): Paint {
  const { colors, colorScheme } = useTokens();
  if (colorScheme === 'light') {
    return {
      ground: colors.accent,
      ink: colors.ink,
      mark: colors.ink,
      giant: colors.onAccent,
      dot: halftone.dot,
      chip: withAlpha(colors.onAccent, shareCardDrawing.chipAlpha.light),
      closedCell: withAlpha(colors.onAccent, shareCardDrawing.closedCellAlpha.light),
      footer: colors.ink,
      onFooter: colors.onAccent,
      onRed: true,
    };
  }
  return {
    ground: colors.background,
    ink: colors.ink,
    mark: colors.accent,
    giant: colors.accent,
    dot: withAlpha(colors.ink, shareCardDrawing.darkDotAlpha),
    chip: withAlpha(colors.ink, shareCardDrawing.chipAlpha.dark),
    closedCell: withAlpha(colors.ink, shareCardDrawing.closedCellAlpha.dark),
    footer: colors.surfaceSunken,
    onFooter: colors.ink,
    onRed: false,
  };
}

/**
 * The Share Card of what the Core built, in a format, `width` points wide, in
 * the app's current Theme, with no app chrome, as the design's share board
 * draws it: red under a halftone raster in the light Theme, the dark ground in
 * the dark one; the brand wedge and the kicker (the overline) on top; the
 * headline in the loud type, the reading text under it; a giant glyph of the
 * headline (its first letter, or its number) behind them off the right edge;
 * and a slanted footer band with the Mascot and the watermark. A Word's shows
 * the Lemma with Stress, the part of speech with gender and registers, and
 * the primary Definition; a Correction's «Так часто кажуть» over the
 * non-standard form struck through and «Українською краще» over the main
 * standard equivalent; an Idiom's its expression, its primary Definition and
 * a place name's «Походження» over its etymology; a Synonym Row's its
 * dominant, its meaning and its first members; a Tip's its title over its
 * forms; a Weekly Recap's its title and the week's numbers in chips; a
 * milestone's its title, headline and the Level's name; a Daily Crossword's
 * its title and its grid without letters. The card is laid out at its own
 * size, so it is sharp at any size, and its type keeps the design's
 * proportions whatever the reader's text size. A headline too wide for its
 * line shrinks to a floor and then wraps; text too tall for the card shrinks
 * until it fits; nothing is cut.
 */
export function ShareCard(props: ShareCardProps & { format: ShareCardFormat; width: number }) {
  // A new Entry, week or format measures from the design's sizes again.
  return <FittedCard key={`${props.content.shows}-${props.format}`} {...props} />;
}

function FittedCard({
  content: { overline, label, body },
  watermark,
  badge,
  format,
  width,
}: ShareCardProps & { format: ShareCardFormat; width: number }) {
  const tokens = useTokens();
  const { voice } = useEdition();
  const paint = usePaint();
  const layout = shareCardLayout[format];
  /** The design's points in this card's points. */
  const unit = width / SHARE_CARD[format].width;
  const [headlineScale, reportHeadline] = useShrinkToFit(HEADLINE_FLOOR);
  // No floor: shrinking is all that keeps a long text whole on the card.
  const [textScale, reportText] = useShrinkToFit(SHRINK_STEP);
  const [room, setRoom] = useState<number>();
  const [measured, setMeasured] = useState<{ height: number; at: number }>();

  useEffect(() => {
    if (room !== undefined && measured !== undefined) {
      reportText(measured.at, measured.height <= room + LAYOUT_SLACK);
    }
  }, [room, measured, reportText]);

  /** A size of the design's text, shrunk with the rest of the text. */
  const text = (size: number) => size * unit * textScale;
  const headlineSize = isEntry(body) ? layout.type.entryHeadline : layout.type.headline;
  const headline = (value: string) => (
    <Text
      allowFontScaling={false}
      onTextLayout={({ nativeEvent }) => {
        reportHeadline(headlineScale, nativeEvent.lines.length <= 1);
      }}
      style={[
        typeStyle('shareHeadline', tokens),
        {
          ...roleAt('shareHeadline', text(headlineSize) * headlineScale),
          letterSpacing: shareCardDrawing.tracking.headline * unit,
          color: paint.ink,
        },
      ]}
    >
      {value}
    </Text>
  );
  const glyph = giantGlyph(body);
  const mascotSize = layout.mascot * unit;

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
          height: SHARE_CARD[format].height * unit,
          paddingHorizontal: layout.padding.horizontal * unit,
          paddingTop: layout.padding.vertical * unit,
          backgroundColor: paint.ground,
        },
      ]}
    >
      <Raster color={paint.dot} unit={unit} />
      {glyph !== undefined && (
        <Text
          testID="share-card-giant"
          allowFontScaling={false}
          numberOfLines={1}
          style={[
            typeStyle('shareGiant', tokens),
            styles.giant,
            {
              right: layout.giant.right * unit,
              top: layout.giant.top * unit,
              ...roleAt('shareGiant', layout.giant.size * unit),
              letterSpacing: shareCardDrawing.tracking.giant * unit,
              color: paint.giant,
            },
          ]}
        >
          {glyph}
        </Text>
      )}
      <View style={styles.brand}>
        <Shape
          wedge={wedges.wedge}
          color={paint.mark}
          width={shareCardDrawing.brand.width * unit}
          height={shareCardDrawing.brand.height * unit}
        />
      </View>
      <View
        onLayout={({ nativeEvent }) => {
          setRoom(nativeEvent.layout.height);
        }}
        style={[styles.room, { marginTop: layout.kickerTop * unit - layout.gap * unit }]}
      >
        <View
          onLayout={({ nativeEvent }) => {
            setMeasured({ height: nativeEvent.layout.height, at: textScale });
          }}
          style={{ gap: text(layout.gap) }}
        >
          {overline !== undefined && (
            <Text
              allowFontScaling={false}
              style={[
                typeStyle('shareKicker', tokens),
                {
                  ...roleAt('shareKicker', text(layout.type.kicker)),
                  letterSpacing: shareCardDrawing.tracking.kicker * unit,
                  color: paint.ink,
                },
              ]}
            >
              {overline}
            </Text>
          )}
          {badge !== undefined && body.kind === 'milestone' && (
            <BadgeMark
              testID="share-card-badge"
              shape={badge.shape}
              tone={badge.tone}
              symbol={badge.symbol}
              state={{ kind: 'earned', isNew: false }}
              size={badgeShareMark.side * unit}
            />
          )}
          <Blocks body={body} headline={headline} text={text} format={format} paint={paint} />
        </View>
      </View>
      <View
        style={[
          styles.footer,
          {
            height: layout.footer * unit,
            paddingHorizontal: layout.padding.horizontal * unit,
            paddingBottom: layout.padding.vertical * unit,
          },
        ]}
      >
        <Shape
          wedge={wedges.rise}
          color={paint.footer}
          width={width}
          height={layout.footer * unit}
          style={StyleSheet.absoluteFill}
        />
        <View style={{ width: mascotSize, height: mascotSize }}>
          <View
            style={[
              styles.mascot,
              { transform: [{ scale: mascotSize / shareCardDrawing.mascotBox }] },
            ]}
          >
            <Mascot state={mascotState(body)} onRed={paint.onRed} />
          </View>
        </View>
        <Text
          allowFontScaling={false}
          style={[
            typeStyle('shareWatermark', tokens),
            {
              ...roleAt('shareWatermark', layout.type.watermark * unit),
              color: paint.onFooter,
              opacity: shareCardDrawing.watermarkOpacity,
            },
          ]}
        >
          {watermark}
        </Text>
      </View>
    </View>
  );
}

/** Whether the card shows an Entry, whose headline is the design's largest. */
function isEntry(body: ShareCardBody): boolean {
  return body.kind !== 'weeklyRecap' && body.kind !== 'milestone' && body.kind !== 'dailyCrossword';
}

/** The Mascot's state on the card, as the share board picks it. */
function mascotState(body: ShareCardBody): MascotState {
  if (body.kind === 'milestone') return 'celebrates';
  if (body.kind === 'weeklyRecap' || body.kind === 'dailyCrossword') return 'happy';
  return 'shouts';
}

/**
 * The giant glyph behind the text: a milestone's number, or the first letter
 * of what the card names, without its Stress; none for a week or a crossword.
 */
function giantGlyph(body: ShareCardBody): string | undefined {
  switch (body.kind) {
    case 'weeklyRecap':
    case 'dailyCrossword':
      return undefined;
    case 'milestone':
      return /\d+/.exec(body.headline)?.[0] ?? firstLetter(body.headline);
    case 'word':
      return firstLetter(body.lemma);
    case 'idiom':
      return firstLetter(body.expression);
    case 'correction':
      return firstLetter(body.standardForm);
    case 'synonymRow':
      return firstLetter(body.dominant);
    case 'tip':
      return firstLetter(body.title);
  }
}

function firstLetter(value: string): string | undefined {
  return /\p{L}/u.exec(value.normalize('NFD'))?.[0].normalize('NFC').toLocaleUpperCase();
}

/** The halftone raster over the whole card, at the card's scale. */
function Raster({ color, unit }: { color: string; unit: number }) {
  const id = `raster${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const cell = halftone.cell * unit;
  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <Pattern id={id} width={cell} height={cell} patternUnits="userSpaceOnUse">
          <Circle cx={cell / 2} cy={cell / 2} r={halftone.radius * unit} fill={color} />
        </Pattern>
      </Defs>
      <Rect width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  );
}

/** A wedge of the design filled with `color`, `width` by `height`. */
function Shape({
  wedge,
  color,
  width,
  height,
  style,
}: {
  wedge: Wedge;
  color: string;
  width: number;
  height: number;
  style?: object;
}) {
  return (
    <Svg width={width} height={height} viewBox="0 0 1 1" preserveAspectRatio="none" style={style}>
      <Polygon points={wedge.map(([x, y]) => `${String(x)},${String(y)}`).join(' ')} fill={color} />
    </Svg>
  );
}

/** What a block needs to draw its text at the card's scale. */
interface BlockProps {
  /** The headline (the Lemma, the main standard equivalent or the expression), shrinking to fit its line. */
  headline: (value: string) => ReactNode;
  /** A size of the design's text in this card's points. */
  text: (size: number) => number;
  format: ShareCardFormat;
  paint: Paint;
}

/** The body of one kind. */
type BodyOf<Kind extends ShareCardBody['kind']> = Extract<ShareCardBody, { kind: Kind }>;

/** The blocks of what the card shows. */
function Blocks({ body, ...props }: BlockProps & { body: ShareCardBody }) {
  switch (body.kind) {
    case 'word':
      return (
        <>
          {props.headline(body.lemma)}
          <Sub {...props} value={body.grammar} label />
          <Sub {...props} value={body.definition} />
        </>
      );
    case 'idiom':
      return (
        <>
          {props.headline(body.expression)}
          <Sub {...props} value={body.definition} />
          {body.etymology !== undefined && <Etymology {...props} value={body.etymology} />}
        </>
      );
    case 'correction':
      return (
        <Forms {...props} nonStandardForm={body.nonStandardForm} standardForm={body.standardForm} />
      );
    case 'synonymRow':
      return (
        <>
          {props.headline(body.dominant)}
          <Sub {...props} value={body.meaning} />
          <Sub {...props} value={body.members} label />
        </>
      );
    case 'tip':
      return (
        <>
          {props.headline(body.title)}
          <Forms
            {...props}
            nonStandardForm={body.nonStandardForm}
            standardForm={body.standardForm}
            small
          />
        </>
      );
    case 'weeklyRecap':
      return <WeeklyRecapBlocks card={body} {...props} />;
    case 'milestone':
      return (
        <>
          <Sub {...props} value={body.title} label />
          {props.headline(body.headline)}
          {body.detail !== undefined && <Sub {...props} value={body.detail} />}
        </>
      );
    case 'dailyCrossword':
      return <DailyCrosswordBlocks card={body} {...props} />;
  }
}

/** Reading text under the headline, or with `label` a short line in the meta type. */
function Sub({
  value,
  text,
  format,
  paint,
  label = false,
  color,
  strike = false,
  size,
}: Pick<BlockProps, 'text' | 'format' | 'paint'> & {
  value: string;
  label?: boolean;
  color?: string;
  strike?: boolean;
  size?: number;
}) {
  const tokens = useTokens();
  const { type } = shareCardLayout[format];
  const fontSize = text(size ?? (label ? type.label : type.sub));
  const role: TypeRole = size !== undefined ? 'shareForm' : label ? 'shareLabel' : 'shareSub';
  return (
    <Text
      allowFontScaling={false}
      style={[
        typeStyle(role, tokens),
        strike && styles.strike,
        {
          ...roleAt(role, fontSize),
          color: color ?? paint.ink,
          opacity: label || color !== undefined ? 1 : shareCardDrawing.subOpacity,
          textDecorationColor: paint.ink,
        },
      ]}
    >
      {value}
    </Text>
  );
}

/** A place name's «Походження» over its etymology. */
function Etymology({ value, ...props }: BlockProps & { value: string }) {
  const { strings } = useEdition();
  return (
    <View>
      <Sub {...props} value={strings.idiomCard.etymology} label color={props.paint.mark} />
      <Sub {...props} value={value} />
    </View>
  );
}

/**
 * «Так часто кажуть» over the non-standard form struck through, when there is
 * one, and «Українською краще» over the standard form: the headline, or with
 * `small` (a Tip's, under its title) the non-standard form's size.
 */
function Forms({
  nonStandardForm,
  standardForm,
  small = false,
  ...props
}: BlockProps & { nonStandardForm: string | undefined; standardForm: string; small?: boolean }) {
  const { strings } = useEdition();
  const { type } = shareCardLayout[props.format];
  return (
    <>
      {nonStandardForm !== undefined && (
        <View>
          <Sub {...props} value={strings.share.nonStandard} label />
          <Sub {...props} value={nonStandardForm} size={type.nonStandard} strike />
        </View>
      )}
      <View>
        <Sub {...props} value={strings.share.standard} label color={props.paint.mark} />
        {small ? (
          <Sub {...props} value={standardForm} size={type.nonStandard} />
        ) : (
          props.headline(standardForm)
        )}
      </View>
    </>
  );
}

/** A Weekly Recap's title and the week's numbers, each in a chip over its label. */
function WeeklyRecapBlocks({ card, ...props }: BlockProps & { card: BodyOf<'weeklyRecap'> }) {
  const tokens = useTokens();
  const { text, format, paint } = props;
  const { type, statBasis, gap } = shareCardLayout[format];
  return (
    <>
      {props.headline(card.title)}
      <View style={[styles.stats, { gap: text(gap) }]}>
        {card.numbers.map(({ label, count }) => (
          <View
            key={label}
            style={{
              flexBasis: statBasis,
              flexGrow: 1,
              padding: text(shareCardDrawing.chipPadding),
              borderRadius: text(shareCardDrawing.chipRadius),
              backgroundColor: paint.chip,
            }}
          >
            <Text
              allowFontScaling={false}
              style={[
                typeStyle('shareStat', tokens),
                {
                  ...roleAt('shareStat', text(type.stat)),
                  color: paint.ink,
                },
              ]}
            >
              {count}
            </Text>
            <Sub {...props} value={label} label />
          </View>
        ))}
      </View>
    </>
  );
}

/** A solved Daily Crossword: its title and its grid with the open cells filled, never a letter. */
function DailyCrosswordBlocks({ card, ...props }: BlockProps & { card: BodyOf<'dailyCrossword'> }) {
  const { text, format, paint } = props;
  const cell = text(shareCardLayout[format].cell);
  const gap = text(shareCardDrawing.cellGap);
  return (
    <>
      {props.headline(card.title)}
      <View style={{ gap }}>
        {card.grid.map((row, r) => (
          <View key={r} style={[styles.gridRow, { gap }]}>
            {row.map((open, c) => (
              <View
                key={c}
                testID={open ? 'crossword-open-cell' : 'crossword-closed-cell'}
                style={{
                  width: cell,
                  height: cell,
                  borderRadius: text(shareCardDrawing.cellRadius),
                  backgroundColor: open ? paint.mark : paint.closedCell,
                }}
              />
            ))}
          </View>
        ))}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  card: { overflow: 'hidden' },
  giant: { position: 'absolute' },
  brand: { flexDirection: 'row' },
  room: { flex: 1 },
  strike: { textDecorationLine: 'line-through' },
  stats: { flexDirection: 'row', flexWrap: 'wrap' },
  gridRow: { flexDirection: 'row' },
  footer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  mascot: { position: 'absolute', left: 0, bottom: 0, transformOrigin: 'left bottom' },
});
