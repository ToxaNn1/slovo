import { fill, type MixKindWeight, type QuickQuestionEvery } from '@slovo/contracts';
import type { MixKind, MixKindName } from '@slovo/core';
import {
  categoryGrid,
  Chip,
  ChipChoice,
  MixCategoryTile,
  SectionLabel,
  SegmentedControl,
  SettingsGroup,
  shapeAt,
  SwitchRow,
  space,
  typeStyle,
  useEdition,
  useTokens,
} from '@slovo/ui';
import { mixTileDrawing } from '@slovo/ui/tokens';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { editionStrings } from '../edition/edition';
import { useEditionInEffect } from '../edition/remote-switches';
import { useMixChanges, useMixScreenModel, useMixState } from './mix';
import type { MixCategoriesModel } from './mix-screen';

const strings = editionStrings.mix;

/**
 * The choices of the Mix on Settings › Мій Мікс (board 11, screen 87): a
 * tile for every Category of the Edition in two columns under «N з M
 * обрано», the line saying why the last Category's tile is disabled and the
 * chip «Усі»; under «Типи карток» the Corrections and Idioms
 * switches, each when the Edition turns it on, with the chips of the Categories of Corrections
 * under the Corrections switch while it is on, and under each kind
 * in the Mix its Mix kind weight while the mixKindWeights switch is on, and
 * how often the Feed asks a Quick Question while the game and quickQuestion
 * switches are on. A change applies at once (the Core's Mix).
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
      <CategoryTiles
        list={model}
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
          <SettingsGroup title={strings.groups.kinds}>
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
 * The Categories of Words as tiles in two columns, each with its pictogram,
 * the big shape of its place on the Categories grid, under the
 * label «Категорії» and «N з M обрано»; then the line saying why the last
 * Category's tile is disabled and `all`, the chip «Усі».
 */
function CategoryTiles({
  list,
  onToggle,
  all,
}: {
  list: MixCategoriesModel;
  onToggle: (categoryId: string, inMix: boolean) => void;
  all: ReactNode;
}) {
  const tokens = useTokens();
  const { colors } = tokens;
  const { voice } = useEdition();
  const selected = list.chips.filter(({ on }) => on).length;
  const tiles = list.chips.map((chip, place) => (
    <View key={chip.id} style={styles.cell}>
      <MixCategoryTile
        testID={`mix-chip-${chip.id}`}
        name={chip.name}
        glyph={shapeAt(categoryGrid.shapes, place)[0]}
        on={chip.on}
        disabled={chip.disabled}
        accessibilityHint={strings.lastCategoryHint}
        onPress={() => {
          onToggle(chip.id, !chip.on);
        }}
      />
    </View>
  ));
  return (
    <View style={styles.categories}>
      <View style={styles.categoriesHead}>
        <SectionLabel>{strings.groups.categories}</SectionLabel>
        <Text
          testID="mix-selected"
          {...voice}
          style={[typeStyle('progressCount', tokens), { color: colors.muted }]}
        >
          {fill(strings.selectedOf, {
            selected: String(selected),
            total: String(list.chips.length),
          })}
        </Text>
      </View>
      <View style={styles.grid}>
        {pairs(tiles).map(([left, right], row) => (
          <View key={row} style={styles.row}>
            {left}
            {right ?? <View style={styles.cell} />}
          </View>
        ))}
      </View>
      {list.lastCategoryHint && (
        <Text
          testID="mix-last-category-hint"
          // VoiceOver reads it as the hint of the disabled tile instead.
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          {...voice}
          style={[typeStyle('sub', tokens), { color: colors.muted }]}
        >
          {strings.lastCategoryHint}
        </Text>
      )}
      <View style={styles.chips}>{all}</View>
    </View>
  );
}

/** The items two by two, the rows of a two-column grid; the last row holds one when they are odd. */
function pairs<T>(items: readonly T[]): (readonly [T, T | undefined])[] {
  const rows: (readonly [T, T | undefined])[] = [];
  for (let at = 0; at < items.length; at += 2) {
    const left = items[at];
    if (left !== undefined) rows.push([left, items[at + 1]]);
  }
  return rows;
}

/**
 * The chips of the Categories of Corrections, and the line saying why the
 * last one's chip is disabled, which VoiceOver reads as that chip's hint
 * instead. `label` gives a chip's VoiceOver label from its Category's name.
 */
function CategoryChips({
  list,
  testIDPrefix,
  hint,
  label,
  onToggle,
}: {
  list: MixCategoriesModel;
  testIDPrefix: string;
  hint: string;
  label: (name: string) => string;
  onToggle: (categoryId: string, inMix: boolean) => void;
}) {
  const tokens = useTokens();
  const { colors } = tokens;
  const { voice } = useEdition();
  return (
    <>
      <View style={styles.chips}>
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
  categories: { gap: space[3] },
  categoriesHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  grid: { gap: mixTileDrawing.gridGap },
  row: { flexDirection: 'row', gap: mixTileDrawing.gridGap },
  cell: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  hint: { marginTop: space[3] },
  quickQuestion: { marginTop: space[6] },
  switches: { marginTop: space[6] },
  underSwitch: { paddingHorizontal: space[4], paddingVertical: space[3] },
});
