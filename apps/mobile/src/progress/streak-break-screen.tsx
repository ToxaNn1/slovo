import {
  BackLink,
  fill,
  PrimaryButton,
  ScreenTitle,
  SectionLabel,
  SegmentedControl,
  space,
  typeSize,
  useEdition,
  useTokens,
} from '@slovo/ui';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useComposition } from '../composition';
import { logError } from '../diagnostics/log';
import { editionStrings } from '../edition/edition';
import { useSubscribed } from '../opening';
import { dayText } from './day-text';

const strings = editionStrings.settings.streakBreak;

/**
 * Settings › Перерва (ADR 0066): what a Break does, and either the choice of
 * its length with the button that starts it, or why none can start today:
 * one runs, or the next one waits for its date.
 */
export function StreakBreakScreen() {
  const { colors, fontFamilies } = useTokens();
  const { voice } = useEdition();
  const router = useRouter();
  const streakBreak = useComposition().streakBreak;
  const state = useSubscribed(streakBreak, ({ state }) => state);
  const [days, setDays] = useState(7);
  const longest = state.kind === 'available' ? state.longest : 0;
  const segments = Array.from({ length: longest }, (_, index) => {
    const value = String(index + 1);
    return { value, label: value, testID: `streak-break-days-${value}` };
  });
  const textStyle = [styles.text, { color: colors.muted, fontFamily: fontFamilies.ui }];

  return (
    <SafeAreaView
      testID="streak-break"
      edges={['top']}
      style={[styles.screen, { backgroundColor: colors.background }]}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <BackLink
          testID="streak-break-back"
          label={editionStrings.settings.title}
          onPress={() => {
            router.back();
          }}
        />
        <View style={styles.section}>
          <ScreenTitle>{strings.title}</ScreenTitle>
          <Text {...voice} style={textStyle}>
            {strings.explanation}
          </Text>
        </View>
        {state.kind === 'available' && (
          <View style={styles.section}>
            <SectionLabel>{strings.length}</SectionLabel>
            <SegmentedControl
              accessibilityLabel={strings.length}
              segments={segments}
              selected={String(Math.min(days, longest))}
              onSelect={(value) => {
                setDays(Number(value));
              }}
            />
            <PrimaryButton
              testID="streak-break-start"
              label={strings.start}
              onPress={() => {
                streakBreak.start(Math.min(days, longest)).catch((error: unknown) => {
                  logError('Could not start the Break', error);
                });
              }}
            />
          </View>
        )}
        {state.kind === 'running' && (
          <Text {...voice} testID="streak-break-running" style={textStyle}>
            {fill(strings.running, { date: dayText(state.lastDay) })}
          </Text>
        )}
        {state.kind === 'waiting' && (
          <Text {...voice} testID="streak-break-waiting" style={textStyle}>
            {fill(strings.waiting, { date: dayText(state.nextStart) })}
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: space[5], paddingTop: space[2], paddingBottom: space[8] },
  section: { gap: space[3], paddingTop: space[2], paddingBottom: space[5] },
  text: { fontSize: typeSize.body, lineHeight: typeSize.body * 1.5 },
});
