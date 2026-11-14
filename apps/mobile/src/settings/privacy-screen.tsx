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
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useComposition } from '../composition';
import { editionStrings } from '../edition/edition';
import { useShell } from '../shell-value';
import { useShown } from '../shown-in-effect';
import { useSettings } from './settings';

const strings = editionStrings.settings;
const privacy = strings.privacy;

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
  const shown = useShown();
  const { current, update } = useSettings();
  const composition = useComposition();
  const { shareFile } = useShell();
  const [failed, setFailed] = useState(false);

  function exportData(share: NonNullable<typeof shareFile>) {
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
      });
  }

  return (
    <SafeAreaView
      testID="privacy"
      edges={['top']}
      style={[styles.screen, { backgroundColor: colors.background }]}
    >
      <ScrollView contentContainerStyle={styles.content}>
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
        <View style={styles.section}>
          <SettingsGroup>
            {shown.shareCountersSetting && (
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
            {shown.dataExport && shareFile !== undefined && (
              <SettingsRow
                testID="privacy-data-export"
                icon="bar"
                label={privacy.dataExport.title}
                subtitle={privacy.dataExport.subtitle}
                end={{
                  kind: 'action',
                  onPress: () => {
                    exportData(shareFile);
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
  content: { paddingHorizontal: space[5], paddingTop: space[2], paddingBottom: space[8] },
  section: { marginTop: space[4] },
  failed: { marginTop: space[2], paddingHorizontal: space[4] },
});
