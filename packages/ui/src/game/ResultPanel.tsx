import { type ReactNode, useId, useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Defs, Pattern, Polygon } from 'react-native-svg';

import { useEdition } from '../providers/EditionProvider';
import { Button } from '../primitives/Button';
import {
  fontScaleCap,
  halftone,
  mascotWidth,
  resultLayout,
  space,
  typeRoles,
  typeStyle,
  wedges,
} from '../tokens';
import { useSchemeColors, useTokens } from '../providers/TokensProvider';
import { WholeWordsText } from '../primitives/WholeWordsText';

export const TITLE_TRACKING = typeRoles.resultTitle.letterSpacing / typeRoles.resultTitle.size;
/** The Mascot's own width on the panel: its figure and the padding it draws around it. */
const MASCOT_COLUMN = mascotWidth + 2 * space[4];

/**
 * The Mascot beside the title on the red panel, no wider than its figure, as
 * the board sets it. Its line wraps under the figure: unbounded, the line
 * would take its whole width on one line, run off the screen and squeeze the
 * title and line beside it until their words break.
 */
export function PanelMascot({ children }: { children: ReactNode }) {
  return (
    <View testID="game-panel-mascot" style={styles.mascot}>
      {children}
    </View>
  );
}

/**
 * The red panel's ground, across the screen's width and the panel's height:
 * the accent cut by its slanted bottom edge, under the halftone raster. The
 * panel is at least the board's height and grows with its text, at the
 * largest text sizes too, so the ground follows the height it is laid out at.
 */
export function PanelGround({ color }: { color: string }) {
  const id = `result${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const { width } = useWindowDimensions();
  const [height, setHeight] = useState<number>(resultLayout.panelHeight);
  const points = wedges.cut.map(([x, y]) => `${String(x * width)},${String(y * height)}`).join(' ');
  return (
    <View
      testID="game-panel-ground"
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      onLayout={({ nativeEvent }) => {
        setHeight(nativeEvent.layout.height);
      }}
    >
      <Svg
        width={width}
        height={height}
        style={StyleSheet.absoluteFill}
        accessible={false}
        pointerEvents="none"
      >
        <Defs>
          <Pattern
            id={id}
            width={halftone.cell}
            height={halftone.cell}
            patternUnits="userSpaceOnUse"
          >
            <Circle
              cx={halftone.cell / 2}
              cy={halftone.cell / 2}
              r={halftone.radius}
              fill={halftone.dot}
            />
          </Pattern>
        </Defs>
        <Polygon points={points} fill={color} />
        <Polygon points={points} fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

/**
 * The red panel over a result: the ground, the title and its `line` read as
 * one heading, and the Mascot beside them.
 */
export function ResultPanel({
  title,
  line,
  lineTestID,
  mascot,
  banner,
  testID,
}: {
  title: string;
  line: string | undefined;
  lineTestID?: string;
  mascot: ReactNode;
  /** What the panel shows over its title, such as the huge «ФІНІШ». */
  banner?: ReactNode;
  /** The panel's foot, under the ground. */
  testID?: string;
}) {
  const tokens = useTokens();
  const { colors } = tokens;
  const { voice } = useEdition();
  const keyInk = useSchemeColors('light').ink;
  return (
    <View style={styles.panel}>
      <PanelGround color={colors.accent} />
      {banner}
      <View testID={testID} style={styles.panelFoot}>
        <View accessible accessibilityRole="header" {...voice} style={styles.text}>
          <WholeWordsText
            text={title}
            typeRole="resultTitle"
            tracking={TITLE_TRACKING}
            style={[typeStyle('resultTitle', tokens), { color: keyInk }]}
          />
          {line === undefined ? null : (
            <Text
              testID={lineTestID}
              maxFontSizeMultiplier={fontScaleCap.text}
              style={[typeStyle('resultLine', tokens), { color: keyInk }]}
            >
              {line}
            </Text>
          )}
        </View>
        <PanelMascot>{mascot}</PanelMascot>
      </View>
    </View>
  );
}

/** A result button: what it says and does, and how a test finds it. */
interface ResultAction {
  readonly testID: string;
  readonly label: string;
  readonly onPress: () => void;
}

/** The row under a result: the neutral way out, then the red way on, if any, side by side. */
export function ResultButtons({ away, on }: { away: ResultAction; on: ResultAction | undefined }) {
  return (
    <View style={styles.buttons}>
      <View style={styles.button}>
        <Button variant="neutral" {...away} />
      </View>
      {on === undefined ? null : (
        <View style={styles.button}>
          <Button {...on} />
        </View>
      )}
    </View>
  );
}

/** One number of the result: a tile with the word that names it over the value, read as one. */
export function ResultNumber({
  value,
  label,
  spoken,
  testID,
}: {
  value: string;
  label: string;
  /** What VoiceOver reads for it. */
  spoken: string;
  testID: string;
}) {
  const tokens = useTokens();
  const { colors } = tokens;
  const { voice } = useEdition();
  return (
    <View
      testID={testID}
      accessible
      accessibilityLabel={spoken}
      {...voice}
      style={[styles.number, { backgroundColor: colors.surfaceSunken }]}
    >
      <Text
        maxFontSizeMultiplier={fontScaleCap.text}
        numberOfLines={1}
        style={[typeStyle('eyebrow', tokens), { color: colors.muted }]}
      >
        {label}
      </Text>
      <Text
        maxFontSizeMultiplier={fontScaleCap.number}
        style={[typeStyle('screenTitle', tokens), { color: colors.ink }]}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { minHeight: resultLayout.panelHeight, justifyContent: 'flex-end' },
  // The title and line on the left, the Mascot on the right, over the slant.
  panelFoot: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: space[3],
    paddingHorizontal: space[5],
    paddingBottom: resultLayout.panelFootBottom,
  },
  text: { flex: 1, gap: space[2] - 2 },
  // The Lives-over poster (board 07, g9): the title across the panel, the Mascot under it, its figure in line with the text.
  mascot: { maxWidth: MASCOT_COLUMN },
  number: {
    flexGrow: 1,
    flexBasis: '40%',
    gap: resultLayout.numberGap,
    padding: space[4],
    borderRadius: resultLayout.numberRadius,
  },
  buttons: { flexDirection: 'row', gap: space[3] },
  button: { flex: 1 },
});
