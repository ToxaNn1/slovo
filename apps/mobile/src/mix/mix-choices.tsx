import {
  fill,
  pluralCount,
  RARITIES,
  type MixKindWeight,
  type QuickQuestionEvery,
} from '@slovo/contracts';
import { categoriesTakenOut, type MixKind, type MixKindName } from '@slovo/core';
import {
  BottomSheet,
  Button,
  Chip,
  coverToneAt,
  MixCategoryCover,
  minTouchTarget,
  MixSettingTile,
  PressedTile,
  RarityRangePicker,
  SegmentedControl,
  SettingsGroup,
  SettingsRow,
  SheetTitle,
  space,
  typeStyle,
  useEdition,
  useTokens,
  type MixCoverTone,
  type MixSettingBar,
} from '@slovo/ui';
import { mixScreenDrawing as drawing } from '@slovo/ui/tokens';
import { memo, useCallback, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { edition, editionStrings } from '../edition/edition';
import { useEditionInEffect } from '../edition/remote-switches';
import { useOpenScreen } from '../use-open-screen';
import { useHiddenSummary } from './hidden';
import { useMixChanges, useMixScreenModel, useMixState } from './mix';
import type { MixChipModel, MixScreenModel } from './mix-screen';
import { useRarityRange } from './rarity-range';

const strings = editionStrings.mix;

/** The sheet a setting tile opens, or the Categories of Corrections the kinds' sheet leads to. */
type MixSheet = 'rarity' | 'kinds' | 'correctionCategories' | 'quickQuestion';

/**
 * «Мої Теми» (board XMix, variant E) under its title: the setting tiles
 * «Рідкість», «Типи» and «Питання», each while the Edition turns its part
 * on and each opening its sheet, then the Categories of Words as covers in
 * the Edition's groups. A change applies at once (the Core's Mix). At the
 * foot, while the tab «Теми» is shown, «Приховане» opens the Hidden screen, whose Categories are the ones
 * out of the Mix (ADR 0019).
 */
export function MixChoices() {
  // The sheet stays drawn while it slides away, so it leaves whole, and goes once it is gone.
  const [sheet, setSheet] = useState<{ open: boolean; showing: MixSheet }>();
  const model = useMixScreenModel();
  // Without the tab, «Мої Теми» opens from Settings, whose own row opens the Hidden screen.
  const mixTab = useEditionInEffect().isFeatureEnabled('mixTab');
  const open = (showing: MixSheet) => {
    setSheet({ open: true, showing });
  };
  const close = () => {
    setSheet((was) => was && { ...was, open: false });
  };
  return (
    <>
      <SettingTiles model={model} open={open} />
      <CategoryGroups model={model} />
      {mixTab && <HiddenRow />}
      <BottomSheet
        visible={sheet?.open === true}
        onClose={close}
        onDismissed={() => {
          setSheet((was) => (was?.open === true ? was : undefined));
        }}
        testID="mix-sheet"
      >
        {sheet !== undefined && (
          // A long sheet scrolls inside itself, under its plate and over «Готово».
          <ScrollView
            showsVerticalScrollIndicator={false}
            showsHorizontalScrollIndicator={false}
            style={styles.sheetScroll}
            testID="mix-sheet-scroll"
          >
            <SheetContent sheet={sheet.showing} model={model} open={open} />
          </ScrollView>
        )}
        <Button label={strings.sheets.done} onPress={close} testID="mix-sheet-done" />
      </BottomSheet>
    </>
  );
}

/** «Приховане» and how much is hidden, opening the Hidden screen with its way back to the tab. */
function HiddenRow() {
  const openScreen = useOpenScreen();
  const summary = useHiddenSummary();
  return (
    <View style={styles.hidden}>
      <SettingsGroup>
        <SettingsRow
          testID="mix-hidden"
          icon="square"
          label={strings.hidden}
          subtitle={undefined}
          end={{
            kind: 'chevron',
            value: summary,
            onPress: () => {
              openScreen('/settings/hidden?from=mix');
            },
          }}
        />
      </SettingsGroup>
    </View>
  );
}

/**
 * The value last chosen on screen, shown at once until its change and every
 * change chosen before it are done: the Mix tells of a change only once it is
 * written and the Feed's eligibility read again. Then the Mix's own value
 * shows, so a change that could not be kept goes back.
 */
function useChosenAtOnce<T>(actual: T): [T, (chosen: T, change: Promise<unknown>) => void] {
  const [chosen, setChosen] = useState<{ value: T }>();
  const latest = useRef<object | undefined>(undefined);
  return [
    chosen === undefined ? actual : chosen.value,
    (value, change) => {
      const turn = {};
      latest.current = turn;
      setChosen({ value });
      void change.finally(() => {
        if (latest.current === turn) setChosen(undefined);
      });
    },
  ];
}

/**
 * The Categories of Words chosen on screen, shown at once until their change
 * and every change chosen after it for the same Category are done.
 */
function useCategoriesAtOnce(): {
  chosen: ReadonlyMap<string, boolean>;
  choose: (categoryIds: readonly string[], inMix: boolean, change: Promise<unknown>) => void;
} {
  const [chosen, setChosen] = useState<ReadonlyMap<string, boolean>>(new Map());
  const turns = useRef(new Map<string, object>());
  const choose = useCallback(
    (categoryIds: readonly string[], inMix: boolean, change: Promise<unknown>) => {
      const turn = {};
      for (const id of categoryIds) turns.current.set(id, turn);
      setChosen((was) => new Map([...was, ...categoryIds.map((id) => [id, inMix] as const)]));
      void change.finally(() => {
        const done = categoryIds.filter((id) => turns.current.get(id) === turn);
        for (const id of done) turns.current.delete(id);
        setChosen((was) => new Map([...was].filter(([id]) => !done.includes(id))));
      });
    },
    [],
  );
  return { chosen, choose };
}

/** How many Categories of Words are in the Mix, «12 з 16», for beside the title. */
export function useMixCount(): { readonly text: string; readonly label: string } {
  const { chips } = useMixScreenModel();
  const selected = String(chips.filter(({ on }) => on).length);
  return {
    text: fill(strings.count, { selected, total: String(chips.length) }),
    label: fill(pluralCount(edition.locale)(strings.countLabel, chips.length), { selected }),
  };
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

/** A kind's level on its tile's bar: out, then each weight in turn; in at «Помірно» while there are no weights. */
function levelOf(on: boolean, weight: MixKindWeight | undefined): number {
  if (!on) return 0;
  return weight === undefined ? 2 : WEIGHTS.indexOf(weight) + 1;
}

function SettingTiles({ model, open }: { model: MixScreenModel; open: (sheet: MixSheet) => void }) {
  const inEffect = useEditionInEffect();
  const { range } = useRarityRange();
  const { quickQuestionEvery } = useMixState();
  const { bar } = drawing;
  const tiles: {
    sheet: MixSheet;
    label: string;
    value: string;
    accessibilityLabel?: string | undefined;
    bars: readonly MixSettingBar[];
  }[] = [];
  if (inEffect.isFeatureEnabled('rarityCeiling'))
    tiles.push({
      sheet: 'rarity',
      label: strings.tiles.rarity,
      value:
        range.from === RARITIES[0] && range.to === RARITIES[RARITIES.length - 1]
          ? strings.tiles.rarityAll
          : range.from === range.to
            ? String(range.from)
            : `${String(range.from)}–${String(range.to)}`,
      bars: RARITIES.map((rarity, at) => ({
        height: bar.base + at * bar.rarityStep,
        lit: rarity >= range.from && rarity <= range.to ? 'accent' : false,
      })),
    });
  if (model.kinds.length > 0) {
    const kindsIn = String(model.kinds.filter(({ on }) => on).length);
    const kindsAll = String(model.kinds.length);
    tiles.push({
      sheet: 'kinds',
      label: strings.tiles.kinds,
      value: `${kindsIn}/${kindsAll}`,
      accessibilityLabel: fill(strings.tiles.kindsLabel, { selected: kindsIn, total: kindsAll }),
      bars: model.kinds.map(({ entryKind, on }) => {
        const level = levelOf(on, model.kindWeights?.[entryKind]);
        return { height: bar.base + level * bar.levelStep, lit: level > 0 ? 'ink' : false };
      }),
    });
  }
  if (inEffect.isFeatureEnabled('quickQuestion')) {
    const at = QUICK_QUESTION_EVERY.findIndex(({ every }) => every === quickQuestionEvery);
    const chosen = QUICK_QUESTION_EVERY[at];
    if (chosen !== undefined)
      tiles.push({
        sheet: 'quickQuestion',
        label: strings.tiles.quickQuestion,
        value: strings.quickQuestion[chosen.name],
        bars: [1, 2, 3].map((step) => ({
          height: bar.base + step * bar.levelStep,
          lit: step <= at ? 'accent' : false,
        })),
      });
  }
  if (tiles.length === 0) return null;
  return (
    <View style={styles.tiles}>
      {tiles.map((tile) => (
        <View key={tile.sheet} style={styles.cell}>
          <MixSettingTile
            testID={`mix-tile-${tile.sheet}`}
            label={tile.label}
            value={tile.value}
            accessibilityLabel={tile.accessibilityLabel}
            bars={tile.bars}
            onPress={() => {
              open(tile.sheet);
            }}
          />
        </View>
      ))}
    </View>
  );
}

function SheetContent({
  sheet,
  model,
  open,
}: {
  sheet: MixSheet;
  model: MixScreenModel;
  open: (sheet: MixSheet) => void;
}) {
  switch (sheet) {
    case 'rarity':
      return <RaritySheet />;
    case 'kinds':
      return <KindsSheet model={model} open={open} />;
    case 'correctionCategories':
      return <CorrectionCategoriesSheet model={model} open={open} />;
    case 'quickQuestion':
      return <QuickQuestionSheet />;
  }
}

/**
 * The Rarity Range and, while the Edition has it, the Rarity Test that sets
 * it again; the sheet closes as the test comes on screen.
 */
function RaritySheet() {
  const { range, setRange } = useRarityRange();
  const rarityTest = useEditionInEffect().isFeatureEnabled('rarityTest');
  const openScreen = useOpenScreen();
  return (
    <>
      <SheetTitle>{strings.sheets.rarity}</SheetTitle>
      <View style={styles.sheetBody}>
        <RarityRangePicker
          testID="mix-rarity"
          rarities={RARITIES}
          range={range}
          onChange={setRange}
        />
        {rarityTest && (
          <Button
            variant="neutral"
            testID="mix-rarity-test"
            label={editionStrings.rarityTest.retake}
            onPress={() => {
              openScreen('/settings/rarity-test');
            }}
          />
        )}
      </View>
    </>
  );
}

function KindsSheet({ model, open }: { model: MixScreenModel; open: (sheet: MixSheet) => void }) {
  return (
    <>
      <SheetTitle>{strings.sheets.kinds}</SheetTitle>
      <View style={styles.sheetBody}>
        {model.kinds.map(({ entryKind, name, on }, at) => (
          <KindRow
            key={entryKind}
            kind={entryKind}
            name={name}
            on={on}
            weight={model.kindWeights?.[entryKind]}
            first={at === 0}
            corrections={entryKind === 'correction' ? model.correctionCategories : undefined}
            open={open}
          />
        ))}
      </View>
    </>
  );
}

/**
 * A kind's row of the kinds' sheet: its name and line, and its choice, «Вимк»
 * and its Mix kind weights, «Менше», «Помірно», «Більше», while the Edition
 * turns the weights on, else «Вимк» and «Увімк»; under Corrections while
 * they are in, the row that opens their Categories. The choice shows at once.
 */
function KindRow({
  kind,
  name,
  on,
  weight,
  first,
  corrections,
  open,
}: {
  kind: MixKind;
  name: MixKindName;
  on: boolean;
  weight: MixKindWeight | undefined;
  first: boolean;
  corrections: MixScreenModel['correctionCategories'];
  open: (sheet: MixSheet) => void;
}) {
  const tokens = useTokens();
  const { colors } = tokens;
  const { voice } = useEdition();
  const { setKind, setKindWeight } = useMixChanges();
  const [selected, choose] = useChosenAtOnce<'off' | 'on' | MixKindWeight>(
    !on ? 'off' : (weight ?? 'on'),
  );
  const shownOn = selected !== 'off';
  const segment = (value: 'off' | 'on' | MixKindWeight) => ({
    value,
    label: strings.kindWeight[value],
    testID: `mix-${name}-${value}`,
  });
  const segments =
    weight === undefined
      ? [segment('off'), segment('on')]
      : [segment('off'), ...WEIGHTS.map(segment)];
  return (
    <View
      style={[
        styles.kind,
        !first && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
      ]}
    >
      <View style={[styles.kindText, !shownOn && { opacity: 0.5 }]}>
        <Text {...voice} style={[typeStyle('hintRowTitle', tokens), { color: colors.ink }]}>
          {strings[name].title}
        </Text>
        <Text {...voice} style={[typeStyle('rowSub', tokens), { color: colors.muted }]}>
          {strings[name].subtitle}
        </Text>
      </View>
      <SegmentedControl
        accessibilityLabel={fill(strings.kindWeight.title, { kind: strings[name].title })}
        segments={segments}
        selected={selected}
        onSelect={(chosen) => {
          choose(
            chosen,
            chosen === 'off'
              ? setKind(kind, false)
              : chosen === 'on'
                ? setKind(kind, true)
                : // From the choice shown, which runs ahead of the Mix while a change lands:
                  // a kind shown out of the Mix comes in at the weight chosen, in one change.
                  selected === 'off'
                  ? setKind(kind, true, chosen)
                  : setKindWeight(kind, chosen),
          );
        }}
      />
      {shownOn && corrections !== undefined && (
        <Pressable
          testID="mix-correction-categories"
          accessibilityRole="button"
          onPress={() => {
            open('correctionCategories');
          }}
          style={[styles.subRow, { borderColor: colors.line }]}
        >
          <Text
            {...voice}
            style={[typeStyle('rowLabel', tokens), styles.grow, { color: colors.ink }]}
          >
            {strings.correctionCategories.row}
          </Text>
          <Text {...voice} style={[typeStyle('headerAction', tokens), { color: colors.ink }]}>
            {fill(strings.correctionCategories.count, countOf(corrections.chips))}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

function CorrectionCategoriesSheet({
  model,
  open,
}: {
  model: MixScreenModel;
  open: (sheet: MixSheet) => void;
}) {
  const tokens = useTokens();
  const { colors } = tokens;
  const { voice } = useEdition();
  const { toggleCategory } = useMixChanges();
  const list = model.correctionCategories;
  return (
    <>
      <SheetTitle>{strings.sheets.correctionCategories}</SheetTitle>
      {list !== undefined && (
        <View style={styles.sheetBody}>
          <View style={styles.between}>
            <Text {...voice} style={[typeStyle('sectionLabel', tokens), { color: colors.ink }]}>
              {fill(strings.correctionCategories.heading, countOf(list.chips))}
            </Text>
            <Chip
              testID="mix-correction-categories-back"
              label={strings.correctionCategories.back}
              on={false}
              onPress={() => {
                open('kinds');
              }}
            />
          </View>
          <Text {...voice} style={[typeStyle('rowSub', tokens), { color: colors.muted }]}>
            {strings.correctionCategories.line}
          </Text>
          <View style={styles.chips}>
            {list.chips.map((chip) => (
              <Chip
                key={chip.id}
                testID={`mix-correction-chip-${chip.id}`}
                label={chip.name}
                accessibilityLabel={fill(strings.corrections.category, { category: chip.name })}
                on={chip.on}
                disabled={chip.disabled}
                accessibilityHint={strings.corrections.lastCategoryHint}
                onPress={() => {
                  void toggleCategory(chip.id, !chip.on, 'correction');
                }}
              />
            ))}
          </View>
          {list.lastCategoryHint && (
            <Text
              testID="mix-correction-last-category-hint"
              // VoiceOver reads it as the hint of the disabled chip instead.
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              {...voice}
              style={[typeStyle('sub', tokens), { color: colors.muted }]}
            >
              {strings.corrections.lastCategoryHint}
            </Text>
          )}
        </View>
      )}
    </>
  );
}

function QuickQuestionSheet() {
  const tokens = useTokens();
  const { colors } = tokens;
  const { voice } = useEdition();
  const { quickQuestionEvery } = useMixState();
  const { setQuickQuestionEvery } = useMixChanges();
  return (
    <>
      <SheetTitle>{strings.sheets.quickQuestion}</SheetTitle>
      <View style={styles.sheetBody}>
        <Text {...voice} style={[typeStyle('rowSub', tokens), { color: colors.muted }]}>
          {strings.quickQuestion.subtitle}
        </Text>
        <View style={styles.options}>
          {QUICK_QUESTION_EVERY.map(({ every, name }) => {
            const chosen = every === quickQuestionEvery;
            const ink = chosen ? colors.onAccent : colors.ink;
            return (
              <View key={name} style={styles.option}>
                <PressedTile
                  testID={`mix-quick-question-${name}`}
                  tone={chosen ? 'accent' : 'tile'}
                  radius={drawing.sheetOption.radius}
                  accessibilityLabel={`${strings.quickQuestion[name]}, ${strings.quickQuestion.lines[name]}`}
                  accessibilityState={{ selected: chosen }}
                  onPress={() => {
                    void setQuickQuestionEvery(every);
                  }}
                  faceStyle={styles.optionFace}
                >
                  <Text {...voice} style={[typeStyle('reviewTitle', tokens), { color: ink }]}>
                    {strings.quickQuestion[name]}
                  </Text>
                  <Text {...voice} style={[typeStyle('recapLabel', tokens), { color: ink }]}>
                    {strings.quickQuestion.lines[name]}
                  </Text>
                </PressedTile>
              </View>
            );
          })}
        </View>
      </View>
    </>
  );
}

/** How many of the chips are on, of how many, for a count template. */
function countOf(chips: readonly MixChipModel[]): { selected: string; total: string } {
  return {
    selected: String(chips.filter(({ on }) => on).length),
    total: String(chips.length),
  };
}

/**
 * The Categories of Words as covers in the Edition's groups, each under its
 * name and the button that puts all of its Categories in, «усі», or, while
 * they all are, takes them out, «зняти»; a group of `twoColumnsUpTo`
 * Categories or fewer in two columns of big covers, a bigger one in three.
 * Without groups the Categories are one list. A cover draws the board's
 * pictogram for its Category's place among the Edition's Categories.
 */
function CategoryGroups({ model }: { model: MixScreenModel }) {
  const tokens = useTokens();
  const { colors } = tokens;
  const { voice } = useEdition();
  const { toggleCategory, setCategories } = useMixChanges();
  const { chosen, choose } = useCategoriesAtOnce();
  const onToggle = useCallback(
    (categoryId: string, inMix: boolean) => {
      choose([categoryId], inMix, toggleCategory(categoryId, inMix));
    },
    [choose, toggleCategory],
  );
  const openScreen = useOpenScreen();
  const onOpen = useCallback(
    (categoryId: string) => {
      openScreen(`/category/${categoryId}`);
    },
    [openScreen],
  );
  /** Whether the Category shows in the Mix: as chosen on screen, else as the Mix has it. */
  const shownOn = ({ id, on }: MixChipModel) => chosen.get(id) ?? on;
  const places = new Map(model.chips.map((chip, place) => [chip.id, { chip, place }]));
  const named = (edition.categoryGroups ?? []).map(({ name, categories }) => ({
    name,
    members: categories.flatMap((id) => places.get(id) ?? []),
  }));
  // A Category of the pack no group names, such as one a content update adds, still shows, last.
  const grouped = new Set(named.flatMap(({ members }) => members.map(({ chip }) => chip.id)));
  const rest = {
    name: undefined,
    members: [...places.values()].filter(({ chip }) => !grouped.has(chip.id)),
  };
  const groups = [...named, rest].filter(({ members }) => members.length > 0);
  return (
    <View style={styles.groups}>
      {groups.map(({ name, members }, group) => {
        const all = members.every(({ chip }) => shownOn(chip));
        const ids = members.map(({ chip }) => chip.id);
        const size = members.length <= drawing.twoColumnsUpTo ? 'two' : 'three';
        const columns = size === 'two' ? 2 : 3;
        return (
          <View key={name ?? group} style={styles.group}>
            {name !== undefined && (
              <View style={styles.between}>
                <Text
                  {...voice}
                  accessibilityRole="header"
                  style={[typeStyle('mixGroupName', tokens), styles.grow, { color: colors.ink }]}
                >
                  {name}
                </Text>
                <Pressable
                  testID={`mix-group-${String(group)}`}
                  accessibilityRole="button"
                  style={styles.groupToggle}
                  onPress={() => {
                    // Drawn as the Core will leave it: a group that holds the Mix's last Categories keeps one lit.
                    const inMix = model.chips.filter(shownOn).map(({ id }) => id);
                    choose(
                      all ? categoriesTakenOut(inMix, ids) : ids,
                      !all,
                      setCategories(ids, !all),
                    );
                  }}
                >
                  <Text
                    {...voice}
                    style={[typeStyle('headerAction', tokens), { color: colors.muted }]}
                  >
                    {fill(strings.group.toggle, {
                      ...countOf(members.map(({ chip }) => ({ ...chip, on: shownOn(chip) }))),
                      action: all ? strings.group.none : strings.group.all,
                    })}
                  </Text>
                </Pressable>
              </View>
            )}
            <View style={[styles.covers, { gap: drawing.cover[size].gap }]}>
              {rowsOf(members, columns).map((row, at) => (
                <View key={at} style={[styles.coverRow, { gap: drawing.cover[size].gap }]}>
                  {Array.from({ length: columns }, (_, column) => {
                    const member = row[column];
                    if (member === undefined) return <View key={column} style={styles.cell} />;
                    const { chip, place } = member;
                    const inGroup = at * columns + column;
                    return (
                      <View key={chip.id} style={styles.cell}>
                        <CoverCell
                          id={chip.id}
                          name={chip.name}
                          place={place}
                          inGroup={inGroup}
                          tone={chip.quiet ? 'quiet' : coverToneAt(place * 2 + inGroup)}
                          size={size}
                          on={shownOn(chip)}
                          disabled={chip.disabled}
                          onToggle={onToggle}
                          onOpen={onOpen}
                        />
                      </View>
                    );
                  })}
                </View>
              ))}
            </View>
          </View>
        );
      })}
      {model.lastCategoryHint && (
        <Text
          testID="mix-last-category-hint"
          // VoiceOver reads it as the hint of the disabled cover instead.
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          {...voice}
          style={[typeStyle('sub', tokens), { color: colors.muted }]}
        >
          {strings.lastCategoryHint}
        </Text>
      )}
    </View>
  );
}

/** One Category's cover, drawn again only when its own Category changes. */
const CoverCell = memo(function CoverCell({
  id,
  name,
  place,
  inGroup,
  tone,
  size,
  on,
  disabled,
  onToggle,
  onOpen,
}: {
  id: string;
  name: string;
  place: number;
  inGroup: number;
  tone: MixCoverTone;
  size: 'two' | 'three';
  on: boolean;
  disabled: boolean;
  onToggle: (categoryId: string, inMix: boolean) => void;
  /** Opens the Category's screen, to see its Words before choosing it. */
  onOpen: (categoryId: string) => void;
}) {
  return (
    <MixCategoryCover
      testID={`mix-chip-${id}`}
      name={name}
      place={place}
      inGroup={inGroup}
      tone={tone}
      size={size}
      on={on}
      disabled={disabled}
      accessibilityHint={strings.lastCategoryHint}
      onPress={() => {
        onToggle(id, !on);
      }}
      onLongPress={() => {
        onOpen(id);
      }}
    />
  );
});

/** The items `columns` by `columns`, the rows of a grid. */
function rowsOf<T>(items: readonly T[], columns: number): (readonly T[])[] {
  const rows: (readonly T[])[] = [];
  for (let at = 0; at < items.length; at += columns) rows.push(items.slice(at, at + columns));
  return rows;
}

const styles = StyleSheet.create({
  tiles: { flexDirection: 'row', gap: drawing.tile.gap },
  cell: { flex: 1, minWidth: 0 },
  groups: { gap: drawing.groupGap, marginTop: drawing.groupGap },
  group: { gap: space[3] },
  between: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[3],
  },
  grow: { flex: 1 },
  covers: {},
  coverRow: { flexDirection: 'row' },
  // A ScrollView grows by default; the sheet takes the content's height, up to the screen's.
  sheetScroll: { flexGrow: 0, flexShrink: 1 },
  hidden: { marginTop: drawing.groupGap },
  sheetBody: { gap: space[3], marginTop: space[2], marginBottom: space[3] },
  kind: { gap: space[3], paddingTop: space[3] },
  groupToggle: { minHeight: minTouchTarget, justifyContent: 'center' },
  kindText: { gap: space[1] },
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    minHeight: minTouchTarget,
    paddingHorizontal: space[3],
    borderRadius: drawing.subRow.radius,
    borderWidth: drawing.subRow.border,
    borderStyle: 'dashed',
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  option: { width: '48%', flexGrow: 1 },
  optionFace: {
    height: drawing.sheetOption.height,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[1],
  },
});
