import { fill, type MixKindWeight, type QuickQuestionEvery } from '@slovo/contracts';
import type { MixKind, MixKindName } from '@slovo/core';
import {
  Chip,
  ChipChoice,
  SegmentedControl,
  SettingsGroup,
  SwitchRow,
  space,
  typeStyle,
  useEdition,
  useTokens,
} from '@slovo/ui';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { editionStrings } from '../edition/edition';
import { useEditionInEffect } from '../edition/remote-switches';
import { useMixChanges, useMixScreenModel, useMixState } from './mix';
import type { MixCategoriesModel } from './mix-screen';

const strings = editionStrings.mix;

/**
 * The choices of the Mix, for Settings › Мій Мікс and the onboarding's Mix
 * step: a chip for «Усі» and every Category of the Edition, the line saying
 * why the last Category's chip is disabled, the Corrections and Idioms
 * switches, each when the Edition turns it on, with the chips of the Categories of Corrections
 * under the Corrections switch while it is on (ADR 0033), and under each kind
 * in the Mix its Mix kind weight while the mixKindWeights switch is on, and
 * how often the Feed asks a Quick Question while the game and quickQuestion
 * switches are on. A change applies at once (the Core's Mix, ADR 0019).
 */
export function MixChoices() {
  const state = useMixState();
  const { toggleCategory, turnAllOn, setKind, setKindWeight, setQuickQuestionEvery } =
    useMixChanges();
  const edition = useEditionInEffect();
  const quickQuestion = edition.isFeatureEnabled('quickQuestion');

  const model = useMixScreenModel();

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
          <Chip
            testID="mix-chip-all"
            label={strings.all}
            on={model.allOn}
            feature
            onPress={turnAllOn}
          />
        }
      />
      {model.kinds.length > 0 && (
        <View style={styles.switches}>
          <SettingsGroup>
            {model.kinds.flatMap(({ entryKind, name, on }) => {
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
                      name={name}
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
      {quickQuestion && (
        <View style={styles.quickQuestion}>
          <ChipChoice
            testID="mix-quick-question"
            title={strings.quickQuestion.title}
            subtitle={strings.quickQuestion.subtitle}
            options={QUICK_QUESTION_EVERY.map(({ every, name }) => ({
              value: every,
              label: strings.quickQuestion[name],
            }))}
            value={state.quickQuestionEvery}
            onChange={setQuickQuestionEvery}
          />
        </View>
      )}
    </>
  );
}

/** The Quick Question frequencies on offer, from never to every 6th card, by their names. */
const QUICK_QUESTION_EVERY: readonly {
  every: QuickQuestionEvery;
  name: 'off' | 'rare' | 'normal' | 'often';
}[] = [
  { every: 'off', name: 'off' },
  { every: 20, name: 'rare' },
  { every: 10, name: 'normal' },
  { every: 6, name: 'often' },
];

const WEIGHTS: readonly MixKindWeight[] = ['less', 'normal', 'more'];

/** The Mix kind weight of one kind: «Менше», «Звичайно» or «Більше». */
function KindWeightChoice({
  kind,
  name,
  title,
  weight,
  onSelect,
}: {
  kind: MixKind;
  name: MixKindName;
  title: string;
  weight: MixKindWeight;
  onSelect: (kind: MixKind, weight: MixKindWeight) => void;
}) {
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
  const tokens = useTokens();
  const { colors } = tokens;
  const { voice } = useEdition();
  return (
    <>
      <View style={styles.chips}>
        {all}
        {list.chips.map((chip) => (
          <Chip
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
          style={[typeStyle('sub', tokens), styles.hint, { color: colors.muted }]}
        >
          {hint}
        </Text>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  hint: { marginTop: space[3] },
  quickQuestion: { marginTop: space[6] },
  switches: { marginTop: space[6] },
  underSwitch: { paddingHorizontal: space[4], paddingVertical: space[3] },
});
