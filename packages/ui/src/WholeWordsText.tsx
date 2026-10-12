import { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextProps,
  type TextStyle,
} from 'react-native';

import type { TextSize } from './FontSizeProvider';

/**
 * Large text that wraps between words and never inside one. On iOS,
 * `adjustsFontSizeToFit` shrinks text only when it runs past its lines, and a
 * word wider than the line is broken inside it, which still fits, so the text
 * keeps its size and the word splits. Here the widest word is measured at
 * `size` first, and the text is drawn small enough for that word to fit on a
 * line; `numberOfLines` and `adjustsFontSizeToFit` still apply on top.
 */
export function WholeWordsText({
  text,
  size,
  tracking,
  style,
  ...props
}: Omit<TextProps, 'children' | 'style'> & {
  text: string;
  /** The size to draw at when every word fits on a line. */
  size: TextSize;
  /** The letter spacing as a share of the font size. */
  tracking: number;
  /** Everything but the size and letter spacing: colour, font and weight. */
  style: StyleProp<TextStyle>;
}) {
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

  return (
    <View
      onLayout={(event) => {
        setLineWidth(event.nativeEvent.layout.width);
      }}
    >
      <Text
        {...props}
        // Hidden until measured, so a word never shows split for a frame.
        style={[style, sized(scale ?? 1), scale === undefined && styles.hidden]}
      >
        {text}
      </Text>
      {/* Every word on its own line, wide enough that none of them wraps. */}
      <View
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={styles.measure}
      >
        <Text
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
