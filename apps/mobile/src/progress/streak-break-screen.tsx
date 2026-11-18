import {
  BackHeader,
  fill,
  Button,
  SectionLabel,
  space,
  Stepper,
  typeStyle,
  useEdition,
  useTokens,
} from '@slovo/ui';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useComposition } from '../composition';
import { keep } from '../keep';
import { editionStrings } from '../edition/edition';
import { useSubscribed } from '../opening';
import { dayText } from './day-text';

const strings = editionStrings.settings.streakBreak;

/**
 * Settings › Перерва (ADR 0066, board 11, 90): what a Break does, and either
 * its length on a − N + stepper from 1 to the longest with the button that
 * starts it, or why none can start today: while one runs, its last day; and
 * while the next one is not yet allowed, the day it can start.
 */
export function StreakBreakScreen() {
  const tokens = useTokens();
  const { colors } = tokens;
  const { voice } = useEdition();
  const router = useRouter();
  const streakBreak = useComposition().streakBreak;
  const state = useSubscribed(streakBreak, ({ state }) => state);
  const [days, setDays] = useState(7);
  const longest = state.kind === 'available' ? state.longest : 0;
  const textStyle = [typeStyle('noticeText', tokens), { color: colors.muted }];

  return (
    <SafeAreaView
      testID="streak-break"
      edges={['top']}
      style={[styles.screen, { backgroundColor: colors.background }]}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <BackHeader
          titleRole="settingsSubTitle"
          title={strings.title}
          back={{
            label: editionStrings.settings.title,
            testID: 'streak-break-back',
            onPress: () => {
              router.back();
            },
          }}
        />
        <View style={styles.section}>
          <Text {...voice} style={textStyle}>
            {strings.explanation}
          </Text>
        </View>
        {state.kind === 'available' && (
          <View style={styles.section}>
            <SectionLabel>{strings.length}</SectionLabel>
            <Stepper
              testID="streak-break-days"
              accessibilityLabel={strings.length}
              fewerLabel={strings.fewerDays}
              moreLabel={strings.moreDays}
              value={Math.min(days, longest)}
              min={1}
              max={longest}
              onChange={setDays}
            />
            <Button
              testID="streak-break-start"
              label={strings.start}
              onPress={() => {
                void keep('the Break', streakBreak.start(Math.min(days, longest)));
              }}
            />
          </View>
        )}
        {state.kind === 'running' && (
          <Text {...voice} testID="streak-break-running" style={textStyle}>
            {fill(strings.running, { date: dayText(state.lastDay) })}
          </Text>
        )}
        {(state.kind === 'running' || state.kind === 'waiting') && (
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
});
