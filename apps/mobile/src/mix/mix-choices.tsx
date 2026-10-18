import {
  MixChip,
  SettingsGroup,
  SwitchRow,
  space,
  typeSize,
  useEdition,
  useTokens,
} from '@slovo/ui';
import { StyleSheet, Text, View } from 'react-native';

import { editionStrings } from '../edition/edition';
import { useEditionInEffect } from '../edition/remote-switches';
import { useMixChanges, useMixState } from './mix';
import { mixScreenModel } from './mix-screen';

const strings = editionStrings.mix;

/**
 * The choices of the Mix, for Settings › Мій Мікс and the onboarding's Mix
 * step: a chip for «Усі» and every Category of the Edition, the line saying
 * why the last Category's chip is disabled, and the Corrections switch when
 * the Edition turns Corrections on. A change applies at once (the Core's Mix,
 * ADR 0019).
 */
export function MixChoices() {
  const state = useMixState();
  const { toggleCategory, turnAllOn, setCorrections } = useMixChanges();
  const { colors, fontFamilies } = useTokens();
  const { voice } = useEdition();
  const edition = useEditionInEffect();

  const model = mixScreenModel({ edition, mix: state });

  return (
    <>
      <View style={styles.chips}>
        <MixChip
          testID="mix-chip-all"
          label={strings.all}
          on={model.allOn}
          feature
          onPress={turnAllOn}
        />
        {model.chips.map((chip) => (
          <MixChip
            key={chip.id}
            testID={`mix-chip-${chip.id}`}
            label={chip.name}
            on={chip.on}
            disabled={chip.disabled}
            accessibilityHint={strings.lastCategoryHint}
            onPress={() => {
              toggleCategory(chip.id, !chip.on);
            }}
          />
        ))}
      </View>
      {model.lastCategoryHint && (
        <Text
          testID="mix-last-category-hint"
          // VoiceOver reads it as the hint of the disabled chip instead.
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          {...voice}
          style={[styles.hint, { color: colors.muted, fontFamily: fontFamilies.ui }]}
        >
          {strings.lastCategoryHint}
        </Text>
      )}
      {model.corrections !== undefined && (
        <View style={styles.corrections}>
          <SettingsGroup>
            <SwitchRow
              testID="mix-corrections"
              label={strings.corrections.title}
              subtitle={strings.corrections.subtitle}
              value={model.corrections.on}
              onChange={setCorrections}
            />
          </SettingsGroup>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  hint: { fontSize: typeSize.body, marginTop: space[3] },
  corrections: { marginTop: space[6] },
});
