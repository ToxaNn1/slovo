import { fill, type MixKindWeight } from '@slovo/contracts';
import { featureOfKind, type MixKind } from '@slovo/core';
import {
  MixChip,
  RarityFloorChoice,
  SegmentedControl,
  SettingsGroup,
  SwitchRow,
  space,
  typeSize,
  useEdition,
  useTokens,
} from '@slovo/ui';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { editionStrings } from '../edition/edition';
import { useEditionInEffect } from '../edition/remote-switches';
import { useMixChanges, useMixState } from './mix';
import { mixScreenModel, type MixCategoriesModel } from './mix-screen';

const strings = editionStrings.mix;

/**
 * The choices of the Mix, for Settings › Мій Мікс and the onboarding's Mix
 * step: a chip for «Усі» and every Category of the Edition, the line saying
 * why the last Category's chip is disabled, the Rarity Floor choice while the
 * rarityFloor switch is on, the Rarity Ceiling choice while the rarityCeiling
 * switch is on, and the Corrections and Idioms switches, each when
 * the Edition turns it on, with the chips of the Categories of Corrections
 * under the Corrections switch while it is on (ADR 0033), and under each kind
 * in the Mix its Mix kind weight while the mixKindWeights switch is on. A change applies at
 * once (the Core's Mix, ADR 0019).
 */
export function MixChoices() {
  const state = useMixState();
  const { toggleCategory, turnAllOn, setKind, setKindWeight, setRarityFloor, setRarityCeiling } =
    useMixChanges();
  const edition = useEditionInEffect();

  const model = mixScreenModel({ edition, mix: state });

  return (
    <>
      <CategoryChips
        list={model}
        testIDPrefix="mix"
        hint={strings.lastCategoryHint}
        onToggle={(id, inMix) => {
          toggleCategory(id, inMix);
        }}
        all={
          <MixChip
            testID="mix-chip-all"
            label={strings.all}
            on={model.allOn}
            feature
            onPress={turnAllOn}
          />
        }
      />
      {model.rarity !== undefined && (
        <View style={styles.rarity}>
          <RarityFloorChoice
            shown
            title={strings.rarity.title}
            subtitle={strings.rarity.subtitle}
            options={model.rarity.floors.map((floor) => ({
              floor,
              label: fill(strings.rarity.floor, { rarity: String(floor) }),
            }))}
            floor={model.rarity.floor}
            onChange={setRarityFloor}
          />
        </View>
      )}
      {model.ceiling !== undefined && (
        <View style={styles.rarity}>
          <RarityFloorChoice
            shown
            testID="mix-rarity-ceiling"
            title={strings.rarity.ceilingTitle}
            subtitle={strings.rarity.ceilingSubtitle}
            options={model.ceiling.ceilings.map((ceiling) => ({
              floor: ceiling,
              label: fill(strings.rarity.ceiling, { rarity: String(ceiling) }),
            }))}
            floor={model.ceiling.ceiling}
            onChange={setRarityCeiling}
          />
        </View>
      )}
      {model.kinds.length > 0 && (
        <View style={styles.switches}>
          <SettingsGroup>
            {model.kinds.flatMap(({ entryKind, on }) => {
              const name = featureOfKind(entryKind);
              const row = (
                <SwitchRow
                  key={entryKind}
                  testID={`mix-${name}`}
                  label={strings[name].title}
                  subtitle={strings[name].subtitle}
                  value={on}
                  onChange={(inMix) => {
                    setKind(entryKind, inMix);
                  }}
                />
              );
              const weight = on && model.kindWeights?.[entryKind];
              const categories = entryKind === 'correction' && model.correctionCategories;
              return [
                row,
                weight && (
                  <View key={`${entryKind}-weight`} style={styles.underSwitch}>
                    <KindWeightChoice
                      kind={entryKind}
                      title={strings[name].title}
                      weight={weight}
                      onSelect={setKindWeight}
                    />
                  </View>
                ),
                categories && (
                  <View key="correction-categories" style={styles.underSwitch}>
                    <CategoryChips
                      list={categories}
                      testIDPrefix="mix-correction"
                      hint={strings.corrections.lastCategoryHint}
                      label={(name) => fill(strings.corrections.category, { category: name })}
                      onToggle={(id, inMix) => {
                        toggleCategory(id, inMix, 'correction');
                      }}
                    />
                  </View>
                ),
              ];
            })}
          </SettingsGroup>
        </View>
      )}
    </>
  );
}

const WEIGHTS: readonly MixKindWeight[] = ['less', 'normal', 'more'];

/** The Mix kind weight of one kind: «Менше», «Звичайно» or «Більше». */
function KindWeightChoice({
  kind,
  title,
  weight,
  onSelect,
}: {
  kind: MixKind;
  title: string;
  weight: MixKindWeight;
  onSelect: (kind: MixKind, weight: MixKindWeight) => void;
}) {
  const name = featureOfKind(kind);
  return (
    <SegmentedControl
      accessibilityLabel={fill(strings.kindWeight.title, { kind: title })}
      segments={WEIGHTS.map((value) => ({
        value,
        label: strings.kindWeight[value],
        testID: `mix-${name}-weight-${value}`,
      }))}
      selected={weight}
      onSelect={(chosen) => {
        onSelect(kind, chosen);
      }}
    />
  );
}

/**
 * The chips of one list of Categories, the Words' or the Corrections', after
 * `all` when given, and the line saying why the last Category's chip is
 * disabled, which VoiceOver reads as that chip's hint instead. `label` gives
 * a chip's VoiceOver label from its Category's name.
 */
function CategoryChips({
  list,
  testIDPrefix,
  hint,
  label = (name) => name,
  onToggle,
  all,
}: {
  list: MixCategoriesModel;
  testIDPrefix: string;
  hint: string;
  label?: (name: string) => string;
  onToggle: (categoryId: string, inMix: boolean) => void;
  all?: ReactNode;
}) {
  const { colors, fontFamilies } = useTokens();
  const { voice } = useEdition();
  return (
    <>
      <View style={styles.chips}>
        {all}
        {list.chips.map((chip) => (
          <MixChip
            key={chip.id}
            testID={`${testIDPrefix}-chip-${chip.id}`}
            label={chip.name}
            accessibilityLabel={label(chip.name)}
            on={chip.on}
            disabled={chip.disabled}
            accessibilityHint={hint}
            onPress={() => {
              onToggle(chip.id, !chip.on);
            }}
          />
        ))}
      </View>
      {list.lastCategoryHint && (
        <Text
          testID={`${testIDPrefix}-last-category-hint`}
          // VoiceOver reads it as the hint of the disabled chip instead.
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          {...voice}
          style={[styles.hint, { color: colors.muted, fontFamily: fontFamilies.ui }]}
        >
          {hint}
        </Text>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  hint: { fontSize: typeSize.body, marginTop: space[3] },
  rarity: { marginTop: space[6] },
  switches: { marginTop: space[6] },
  underSwitch: { paddingHorizontal: space[4], paddingVertical: space[3] },
});
