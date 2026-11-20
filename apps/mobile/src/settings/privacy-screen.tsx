import {
  BackHeader,
  SettingsGroup,
  SettingsRow,
  space,
  typeStyle,
  useEdition,
  useTokens,
} from '@slovo/ui';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useComposition } from '../composition';
import { editionStrings } from '../edition/edition';
import { useShell, type ShareFile } from '../shell-value';
import { useShown } from '../shown-in-effect';
import { useSettings } from './settings';
import { useEditionInEffect } from '../edition/remote-switches';

const strings = editionStrings.settings;
const privacy = strings.privacy;

/** The rows «Конфіденційність» draws: the share window is undefined while no export row shows. */
export interface PrivacyRows {
  readonly shareCounters: boolean;
  readonly dataExport: ShareFile | undefined;
}

/**
 * What «Конфіденційність» can draw: the switch while its feature is on in
 * effect, the export while its feature is on and the binary has the file
 * module. Settings shows the row to the screen only while one of them shows.
 */
export function usePrivacyRows(): PrivacyRows {
  const shown = useShown();
  const inEffect = useEditionInEffect();
  const { shareFile } = useShell();
  return {
    shareCounters: shown.shareCountersSetting,
    dataExport: inEffect.isFeatureEnabled('dataExport') ? shareFile : undefined,
  };
}

/**
 * «Конфіденційність» (ADR 0135): the one switch «Анонімна статистика», which
 * gates Analytics and the Community Counters, with what it shares under it,
 * and «Експортувати мої дані», which builds the Data export on the device and
 * hands it to the system share window. Each shows while its feature is on in
 * effect; the export also needs the binary's file module.
 */
export function PrivacyScreen() {
  const tokens = useTokens();
  const { colors } = tokens;
  const { voice } = useEdition();
  const router = useRouter();
  const { shareCounters, dataExport } = usePrivacyRows();
  const { current, update } = useSettings();
  const composition = useComposition();
  const [failed, setFailed] = useState(false);
  // One export at a time: a second share sheet while one is up is refused.
  const exporting = useRef(false);

  function exportData(share: ShareFile) {
    if (exporting.current) return;
    exporting.current = true;
    setFailed(false);
    composition
      .dataExport()
      .then((exported) =>
        share({
          name: `slovo-${exported.edition}-data.json`,
          text: JSON.stringify(exported, null, 2),
          title: privacy.dataExport.fileTitle,
        }),
      )
      .catch(() => {
        setFailed(true);
      })
      .finally(() => {
        exporting.current = false;
      });
  }

  return (
    <SafeAreaView
      testID="privacy"
      edges={['top']}
      style={[styles.screen, { backgroundColor: colors.background }]}
    >
      <View style={styles.bar}>
        <BackHeader
          titleRole="settingsSubTitle"
          title={privacy.title}
          back={{
            label: strings.title,
            testID: 'privacy-back',
            onPress: () => {
              router.back();
            },
          }}
        />
      </View>
      <ScrollView testID="privacy-scroll" contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <SettingsGroup>
            {shareCounters && (
              <SettingsRow
                testID="privacy-share-counters"
                icon="diamond"
                label={privacy.statsTitle}
                subtitle={strings.anonymousStats.explanation}
                end={{
                  kind: 'switch',
                  value: current.shareCounters,
                  onChange: (shareCounters) => {
                    update({ shareCounters });
                  },
                }}
              />
            )}
            {dataExport !== undefined && (
              <SettingsRow
                testID="privacy-data-export"
                icon="bar"
                label={privacy.dataExport.title}
                subtitle={privacy.dataExport.subtitle}
                end={{
                  kind: 'action',
                  onPress: () => {
                    exportData(dataExport);
                  },
                }}
              />
            )}
          </SettingsGroup>
          {failed && (
            <Text
              testID="privacy-data-export-failed"
              accessibilityRole="alert"
              {...voice}
              style={[typeStyle('rowSub', tokens), styles.failed, { color: colors.muted }]}
            >
              {privacy.dataExport.failed}
            </Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  // The back header stays above the list, so the list scrolls under it, not the header under the status bar.
  bar: { paddingHorizontal: space[5], paddingTop: space[2] },
  content: { paddingHorizontal: space[5], paddingBottom: space[8] },
  section: { marginTop: space[4] },
  failed: { marginTop: space[2], paddingHorizontal: space[4] },
});
