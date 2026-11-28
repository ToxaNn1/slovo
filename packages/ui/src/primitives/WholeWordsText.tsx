import type { TextRange } from '@slovo/core';
import { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextProps,
  type TextStyle,
} from 'react-native';

import { WholeLinesText } from './WholeLines';
import { useTitleFactor, type TextSize } from '../providers/FontSizeProvider';
import { clearMarks, FallingMarks, withMarks, type FallingMarksOf } from './FallingMarks';
import { FlyingText, type FlyingTextOf } from './FlyingText';
import { capitalMarkRoom, roleSize, titleScale, typeRoles, type TypeRole } from '../tokens';

/** How far a text still too big at the smallest step of the scale may shrink to fit its lines. */
const FLOOR_SHRINK = 0.7;

/** How far any other text with `lines` may shrink to fit them. */
const LINES_SHRINK = 0.5;

/**
 * Large text that wraps between words and never inside one. On iOS,
 * `adjustsFontSizeToFit` shrinks text only when it runs past its lines, and a
 * word wider than the line is broken inside it, which still fits, so the text
 * keeps its size and the word splits. Here the widest word is measured first.
 * A card's title (`stepped`) is tried at `size`, then at each lower
 * step of `titleScale` (grown as the Lemma is at the user's text size), and
 * drawn at the largest step at which its widest word fits the line and the
 * whole text its lines; one too big even at the smallest step shrinks there,
 * down to 0.7 of it, and with `ellipsis` ends in «…» if it still does not
 * fit. Any other text is drawn just small enough for its widest word to fit a
 * line, and with `lines` shrinks down to half its size rather than run past
 * them. `lines` is the rule for an Entry card's title: a phrase takes at most
 * that many lines, a single word one.
 * A `highlight` draws one stretch of the text in a style of its own, or
 * `falling` lets the text's marks fall into place over it, and `stressed`
 * sets the letters a mark sits on, with the mark, in a style of their own. `flying` lets it
 * fly into place over it as one. The text sets its own top
 * padding and margin: the room its `typeRole`'s capital marks need at the size
 * it is drawn at.
 */
export function WholeWordsText({
  text,
  typeRole,
  size = roleSize(typeRole),
  tracking = typeRoles[typeRole].letterSpacing / typeRoles[typeRole].size,
  style,
  highlight,
  falling,
  stressed,
  flying,
  lines,
  stepped = false,
  ellipsis = false,
  ...given
}: Omit<TextProps, 'children' | 'style' | 'ellipsizeMode'> & {
  text: string;
  /** The most lines a phrase takes; a single word takes one. */
  lines?: number | undefined;
  /**
   * Whether the text is a card's title, drawn at a step of `titleScale`;
   * any other text too wide for its line shrinks just enough for its widest word.
   */
  stepped?: boolean | undefined;
  /** Whether a text that does not fit even shrunk at the smallest step ends in «…». */
  ellipsis?: boolean | undefined;
  /** The type role the text is set in. */
  typeRole: TypeRole;
  /** The size to start from, the largest it is drawn at: the role's own unless given. */
  size?: TextSize | undefined;
  /** The letter spacing as a share of the font size: the role's own unless given. */
  tracking?: number | undefined;
  /** Everything but the size and letter spacing: colour, font and weight. */
  style: StyleProp<TextStyle>;
  /** The text flying into place over it, which is drawn clear meanwhile. */
  flying?: FlyingTextOf | undefined;
} & (
    | {
        /** A stretch of the text to mark, and how it looks on top of `style`. */
        highlight?: { readonly range: TextRange; readonly style: StyleProp<TextStyle> } | undefined;
        falling?: never;
        stressed?: never;
      }
    | {
        highlight?: never;
        /** Marks that fall into place over the text, which leaves them clear meanwhile. */
        falling: FallingMarksOf | undefined;
        /** A mark of the text, and how the letters it sits on look with it, on top of `style`. */
        stressed?: { readonly mark: string; readonly style: StyleProp<TextStyle> } | undefined;
      }
  )) {
  const factor = useTitleFactor();
  const words = text.split(' ');
  const phrase = words.length > 1;
  // The sizes a stepped text tries, largest first: the start size, then every lower step of the scale.
  const steps = stepped
    ? [
        size.fontSize,
        ...titleScale.map((step) => step * factor).filter((step) => step < size.fontSize - 0.01),
      ]
    : [size.fontSize];
  const floor = steps.length - 1;
  // The step tried counts only for the text, start size and lines it was tried for.
  const fitKey = [text, size.fontSize, lines ?? ''].join('|');
  const [fit, setFit] = useState({ key: fitKey, step: 0 });
  const step = fit.key === fitKey ? fit.step : 0;
  const triedAt = [fitKey, step].join('|');
  const [lineWidth, setLineWidth] = useState<number>();
  const [widestWord, setWidestWord] = useState<{ at: string; width: number }>();
  const [lineCount, setLineCount] = useState<{ at: string; count: number }>();
  // A stepped phrase with `lines` must also fit them; a single word fits its one line when it fits the width.
  const maxLines = stepped && lines !== undefined && phrase ? lines : undefined;
  // A word that fits keeps the size: in a view that hugs the text, a smaller size would narrow
  // the view and shrink it again.
  const widest =
    lineWidth === undefined || widestWord?.at !== triedAt ? undefined : widestWord.width;
  const wordFits =
    widest === undefined || lineWidth === undefined ? undefined : widest <= lineWidth;
  const linesFit =
    maxLines === undefined
      ? true
      : lineCount?.at === [triedAt, lineWidth ?? ''].join('|')
        ? lineCount.count <= maxLines
        : undefined;
  const fits =
    wordFits === false || linesFit === false
      ? false
      : wordFits === undefined || linesFit === undefined
        ? undefined
        : true;
  // A word's width grows with its size, so one measure tells the step its widest word fits at:
  // the text jumps there and is measured once more, rather than tried at every step between
  // (27.11 pass: a long title stayed hidden for a pass per step). The guess errs a point
  // large, and a step it got wrong is tried on from.
  const nextStep = () => {
    if (wordFits !== false || widest === undefined || lineWidth === undefined) return step + 1;
    const at = steps[step] ?? size.fontSize;
    const fitting = steps.findIndex(
      (candidate, index) => index > step && (widest * candidate) / at <= lineWidth + 1,
    );
    return fitting === -1 ? floor : fitting;
  };
  if (stepped && fits === false && step < floor) setFit({ key: fitKey, step: nextStep() });
  const atFloor = stepped && fits === false && step >= floor;
  const settled = fits === true || (fits === false && (!stepped || step >= floor));
  // A text off the scale too wide for its line shrinks just enough, with a point of slack so
  // rounding never pushes it back over the edge.
  const ratio =
    !stepped && widest !== undefined && lineWidth !== undefined && widest > lineWidth
      ? (lineWidth - 1) / widest
      : (steps[step] ?? size.fontSize) / size.fontSize;

  const props = {
    ...given,
    ...(lines === undefined && !atFloor
      ? {}
      : {
          // Without `lines`, a phrase too big at the floor shrinks to a line per word at most.
          numberOfLines: phrase ? (lines ?? words.length) : 1,
          adjustsFontSizeToFit: true,
          minimumFontScale: stepped ? FLOOR_SHRINK : LINES_SHRINK,
        }),
    ...(ellipsis ? { ellipsizeMode: 'tail' as const } : {}),
  };
  const sized = (at: number) => {
    const drawn = { fontSize: size.fontSize * at, lineHeight: size.lineHeight * at };
    const room = capitalMarkRoom(typeRole, drawn);
    return {
      ...drawn,
      letterSpacing: drawn.fontSize * tracking,
      paddingTop: room,
      marginTop: 0 - room,
    };
  };

  // Hidden until it fits, so a word never shows split or too big for a frame.
  const textStyle = [style, sized(ratio), !settled && styles.hidden];
  const textProps = {
    numberOfLines: props.numberOfLines,
    adjustsFontSizeToFit: props.adjustsFontSizeToFit,
    minimumFontScale: props.minimumFontScale,
    allowFontScaling: props.allowFontScaling,
    maxFontSizeMultiplier: props.maxFontSizeMultiplier,
  };

  // The text as drawn: marks that fall on their own left clear, stressed letters in their style.
  const shown =
    falling !== undefined ? (
      withMarks(text, falling.mark, clearMarks, stressed?.style)
    ) : stressed !== undefined ? (
      withMarks(text, stressed.mark, stressed.style, stressed.style)
    ) : highlight === undefined ? (
      text
    ) : (
      <>
        {text.slice(0, highlight.range.start)}
        <Text style={highlight.style}>
          {text.slice(highlight.range.start, highlight.range.end)}
        </Text>
        {text.slice(highlight.range.end)}
      </>
    );

  return (
    <View
      onLayout={(event) => {
        // A view not laid out yet reports no width, which would scale the text away.
        if (event.nativeEvent.layout.width > 0) setLineWidth(event.nativeEvent.layout.width);
      }}
    >
      <WholeLinesText
        {...props}
        style={flying === undefined ? textStyle : [textStyle, styles.clear]}
      >
        {shown}
      </WholeLinesText>
      {falling === undefined ? null : (
        <FallingMarks
          text={text}
          falling={falling}
          fontSize={size.fontSize * ratio}
          textProps={textProps}
          style={textStyle}
          markStyle={stressed?.style}
          testID={props.testID === undefined ? undefined : `${props.testID}-falling`}
        />
      )}
      {flying === undefined ? null : (
        <FlyingText
          flying={flying}
          textProps={textProps}
          style={textStyle}
          testID={props.testID === undefined ? undefined : `${props.testID}-flying`}
        >
          {shown}
        </FlyingText>
      )}
      {/* Every word on its own line, wide enough that none of them wraps, at the size tried. */}
      <View
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={styles.measure}
      >
        <Text
          testID={props.testID === undefined ? undefined : `${props.testID}-words`}
          // Scaled like the text itself, or a growth cap would leave the word measured too wide.
          allowFontScaling={props.allowFontScaling}
          maxFontSizeMultiplier={props.maxFontSizeMultiplier}
          onTextLayout={(event) => {
            const width = Math.max(...event.nativeEvent.lines.map((line) => line.width));
            setWidestWord({ at: triedAt, width });
          }}
          style={[style, sized(stepped ? ratio : 1)]}
        >
          {words.join('\n')}
        </Text>
      </View>
      {/* The whole text on the line's width at the size tried, to count its lines. */}
      {maxLines === undefined || lineWidth === undefined ? null : (
        <View
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[styles.measureLines, { width: lineWidth }]}
        >
          <Text
            testID={props.testID === undefined ? undefined : `${props.testID}-lines`}
            allowFontScaling={props.allowFontScaling}
            maxFontSizeMultiplier={props.maxFontSizeMultiplier}
            onTextLayout={(event) => {
              setLineCount({
                at: [triedAt, lineWidth].join('|'),
                count: event.nativeEvent.lines.length,
              });
            }}
            style={[style, sized(ratio)]}
          >
            {text}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  hidden: { opacity: 0 },
  clear: { color: 'transparent' },
  measure: { position: 'absolute', top: 0, left: 0, width: 10000, opacity: 0 },
  measureLines: { position: 'absolute', top: 0, left: 0, opacity: 0 },
});
