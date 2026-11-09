import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { useEdition } from '../providers/EditionProvider';
import { useSchemeColors, useTokens } from '../providers/TokensProvider';
import { Button } from '../primitives/Button';
import { WholeWordsText } from '../primitives/WholeWordsText';
import {
  blockGap,
  dailyCrosswordCard,
  fontScaleCap,
  resultLayout,
  space,
  typeStyle,
} from '../tokens';
import { PanelGround, TITLE_TRACKING } from './GameResult';

const { mini } = dailyCrosswordCard;

/**
 * The solved screen of the crossing Daily Crossword (ADR 0087, spec #1674),
 * over the red halftone panel of the result screen: «Розгадано!», the Solve
 * time and the Mascot celebrating; then «Поділитися без спойлера» over the
 * grid in red and blocks with no letter, the share line, «Поділитися» and
 * «До ігор». Nothing moves on it, so it is the same with Reduce Motion on.
 */
export function CrosswordSolvedPoster({
  time,
  grid,
  share,
  onShare,
  onToGames,
  mascot,
}: {
  /** The Solve time, e.g. «3:42»; none while the Edition keeps no Solve time. */
  time: string | undefined;
  /** The grid by rows: `true` for a cell of a Word, `false` for a block. */
  grid: readonly (readonly boolean[])[];
  /** The share line: its head, e.g. «SLOVO · Кросворд №12», and its line, e.g. «3:42 · без підказок». */
  share: { readonly title: string; readonly line: string | undefined };
  /** Shares the share line; none while the device cannot share. */
  onShare: (() => void) | undefined;
  /** Opens the Games hub. */
  onToGames: () => void;
  /** The Mascot celebrating, drawn for the red panel; none without it. */
  mascot?: ReactNode;
}) {
  const tokens = useTokens();
  const { colors } = tokens;
  const { strings, voice } = useEdition();
  const texts = strings.game.dailyCrossword.solvedScreen;
  const keyInk = useSchemeColors('light').ink;

  return (
    <ScrollView
      testID="crossword-solved-screen"
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.screen}
    >
      <View style={styles.panel}>
        <PanelGround color={colors.accent} />
        <View style={styles.panelFoot}>
          <View accessible {...voice} style={styles.text}>
            <WholeWordsText
              text={texts.title}
              typeRole="resultTitle"
              tracking={TITLE_TRACKING}
              accessibilityRole="header"
              style={[typeStyle('resultTitle', tokens), { color: keyInk }]}
            />
            {time === undefined ? null : (
              <Text
                testID="crossword-solved-time"
                maxFontSizeMultiplier={fontScaleCap.text}
                style={[typeStyle('resultLine', tokens), { color: keyInk }]}
              >
                {time}
              </Text>
            )}
          </View>
          {mascot}
        </View>
      </View>
      <View style={styles.body}>
        <Text
          maxFontSizeMultiplier={fontScaleCap.text}
          accessibilityRole="header"
          style={[typeStyle('eyebrow', tokens), { color: colors.muted }]}
        >
          {texts.shareNoSpoiler}
        </Text>
        <View
          style={styles.grid}
          accessible={false}
          importantForAccessibility="no-hide-descendants"
        >
          {grid.map((row, r) => (
            <View key={r} style={styles.gridRow}>
              {row.map((open, c) => (
                <View
                  key={c}
                  testID={`crossword-solved-${open ? 'open' : 'block'}-${String(r)}-${String(c)}`}
                  style={[styles.cell, { backgroundColor: open ? colors.accent : colors.ink }]}
                />
              ))}
            </View>
          ))}
        </View>
        <View testID="crossword-solved-share-line" accessible {...voice} style={styles.line}>
          <Text
            maxFontSizeMultiplier={fontScaleCap.text}
            style={[typeStyle('resultLine', tokens), { color: colors.ink }]}
          >
            {share.title}
          </Text>
          {share.line === undefined ? null : (
            <Text
              maxFontSizeMultiplier={fontScaleCap.text}
              style={[typeStyle('hint', tokens), { color: colors.muted }]}
            >
              {share.line}
            </Text>
          )}
        </View>
        <View style={styles.buttons}>
          <View style={styles.button}>
            <Button
              variant="neutral"
              testID="crossword-solved-to-games"
              label={texts.toGames}
              onPress={onToGames}
            />
          </View>
          {onShare === undefined ? null : (
            <View style={styles.button}>
              <Button testID="crossword-solved-share" label={texts.share} onPress={onShare} />
            </View>
          )}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flexGrow: 1, paddingBottom: space[8] + space[2] },
  panel: { height: resultLayout.panelHeight, justifyContent: 'flex-end' },
  panelFoot: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: space[3],
    paddingHorizontal: space[5],
    paddingBottom: resultLayout.panelFootBottom,
  },
  text: { flex: 1, gap: space[2] - 2 },
  body: { paddingHorizontal: space[5], gap: blockGap },
  grid: { gap: mini.gap, alignSelf: 'center' },
  gridRow: { flexDirection: 'row', gap: mini.gap },
  cell: { width: mini.cell * 1.5, height: mini.cell * 1.5, borderRadius: mini.radius },
  line: { gap: space[1], alignItems: 'center' },
  buttons: { flexDirection: 'row', gap: space[3] },
  button: { flex: 1 },
});
