import {
  BackHeader,
  NarratorVoicePicker,
  space,
  typeStyle,
  useEdition,
  useTokens,
} from '@slovo/ui';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { edition, editionStrings } from '@/edition/edition';
import { useSampleReading } from '@/entries/pronunciation-button';
import { useSettings } from '@/settings/settings';

const strings = editionStrings.settings.narratorVoice;

/**
 * Settings › «Голос диктора»: the Narrator Voices to choose from over the
 * sample Word. A tap on a voice chooses it and reads the sample in it at once
 * (ADR 0083).
 */
export default function NarratorVoiceScreen() {
  const tokens = useTokens();
  const { colors } = tokens;
  const { voice } = useEdition();
  const router = useRouter();
  const { current, update } = useSettings();
  const sample = useSampleReading();
  return (
    <SafeAreaView
      testID="narrator-voice-screen"
      edges={['top']}
      style={[styles.screen, { backgroundColor: colors.background }]}
    >
      <View style={styles.bar}>
        <BackHeader
          titleRole="settingsSubTitle"
          title={strings.title}
          back={{
            label: editionStrings.settings.title,
            testID: 'narrator-voice-back',
            onPress: () => {
              router.back();
            },
          }}
        />
      </View>
      <ScrollView testID="narrator-voice-scroll" contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text {...voice} style={[typeStyle('sub', tokens), { color: colors.muted }]}>
            {strings.lead}
          </Text>
        </View>
        <NarratorVoicePicker
          testID="narrator-voice"
          voices={edition.narratorVoices}
          chosen={edition.narratorVoiceOf(current.narratorVoice).id}
          sample={edition.narratorVoiceSample}
          playing={sample.playing}
          onChoose={(id) => {
            update({ narratorVoice: id });
            sample.readIn(id);
          }}
          onToggle={sample.toggle}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  // The back header stays above the list, so the list scrolls under it, not the header under the status bar.
  bar: { paddingHorizontal: space[5], paddingTop: space[2], paddingBottom: space[2] },
  content: { paddingHorizontal: space[5], paddingBottom: space[8] },
  header: { gap: space[2], paddingTop: space[2], paddingBottom: space[5] },
});
