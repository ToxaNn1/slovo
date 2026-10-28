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

import type { TextSize } from '../providers/FontSizeProvider';
import { clearMarks, FallingMarks, withMarks, type FallingMarksOf } from './FallingMarks';

/**
 * Large text that wraps between words and never inside one. On iOS,
 * `adjustsFontSizeToFit` shrinks text only when it runs past its lines, and a
 * word wider than the line is broken inside it, which still fits, so the text
 * keeps its size and the word splits. Here the widest word is measured at
 * `size` first, and the text is drawn small enough for that word to fit on a
 * line; `numberOfLines` and `adjustsFontSizeToFit` still apply on top.
 * A `highlight` draws one stretch of the text in a style of its own, or
 * `falling` lets the text's marks fall into place over it.
 */
export function WholeWordsText({
  text,
  size,
  tracking,
  style,
  highlight,
  falling,
  ...props
}: Omit<TextProps, 'children' | 'style'> & {
  text: string;
  /** The size to draw at when every word fits on a line. */
  size: TextSize;
  /** The letter spacing as a share of the font size. */
  tracking: number;
  /** Everything but the size and letter spacing: colour, font and weight. */
  style: StyleProp<TextStyle>;
} & (
    | {
        /** A stretch of the text to mark, and how it looks on top of `style`. */
        highlight?: { readonly range: TextRange; readonly style: StyleProp<TextStyle> } | undefined;
        falling?: never;
      }
    | {
        highlight?: never;
        /** Marks that fall into place over the text, which leaves them clear meanwhile. */
        falling: FallingMarksOf | undefined;
      }
  )) {
  const [lineWidth, setLineWidth] = useState<number>();
  const [widestWord, setWidestWord] = useState<number>();
  // A point of slack, so rounding never pushes the widest word back over the edge.
  const scale =
    lineWidth === undefined || widestWord === undefined
      ? undefined
      : Math.min(1, (lineWidth - 1) / widestWord);
  const sized = (ratio: number) => ({
    fontSize: size.fontSize * ratio,
    lineHeight: size.lineHeight * ratio,
    letterSpacing: size.fontSize * ratio * tracking,
  });

  // Hidden until measured, so a word never shows split for a frame.
  const textStyle = [style, sized(scale ?? 1), scale === undefined && styles.hidden];

  return (
    <View
      onLayout={(event) => {
        // A view not laid out yet reports no width, which would scale the text away.
        if (event.nativeEvent.layout.width > 0) setLineWidth(event.nativeEvent.layout.width);
      }}
    >
      <Text {...props} style={textStyle}>
        {falling !== undefined ? (
          withMarks(text, falling.mark, clearMarks)
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
        )}
      </Text>
      {falling === undefined ? null : (
        <FallingMarks
          text={text}
          falling={falling}
          fontSize={size.fontSize * (scale ?? 1)}
          textProps={{
            numberOfLines: props.numberOfLines,
            adjustsFontSizeToFit: props.adjustsFontSizeToFit,
            minimumFontScale: props.minimumFontScale,
            allowFontScaling: props.allowFontScaling,
            maxFontSizeMultiplier: props.maxFontSizeMultiplier,
          }}
          style={textStyle}
          testID={props.testID === undefined ? undefined : `${props.testID}-falling`}
        />
      )}
      {/* Every word on its own line, wide enough that none of them wraps. */}
      <View
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={styles.measure}
      >
        <Text
          // Scaled like the text itself, or a growth cap would leave the word measured too wide.
          allowFontScaling={props.allowFontScaling}
          maxFontSizeMultiplier={props.maxFontSizeMultiplier}
          onTextLayout={(event) => {
            setWidestWord(Math.max(...event.nativeEvent.lines.map((line) => line.width)));
          }}
          style={[style, sized(1)]}
        >
          {text.split(' ').join('\n')}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hidden: { opacity: 0 },
  measure: { position: 'absolute', top: 0, left: 0, width: 10000, opacity: 0 },
});
