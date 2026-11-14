import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BackHeader } from '../primitives/BackHeader';
import { ChoiceMark } from '../primitives/ChoiceMark';
import { WholeWordsText } from '../primitives/WholeWordsText';
import { useEdition } from '../providers/EditionProvider';
import { useLemmaSize, useWordTextSizes } from '../providers/FontSizeProvider';
import { useTokens } from '../providers/TokensProvider';
import { minTouchTarget, optionScreenDrawing as drawing, space, typeStyle } from '../tokens';
import { SettingsGroup } from './SettingsRows';

/** An option of an option screen: its value, the label its row shows, and the row's test id. */
export interface OptionScreenOption<T extends string> {
  value: T;
  label: string;
  testID?: string | undefined;
}

/**
 * A screen a Settings row opens to choose one option (board 11: 85 «Ціль
 * дня», the font screen): the back tile and the title, the line under it, a
 * card with a large sample of the chosen option and the line that explains
 * it, then the options in one list, the chosen one marked. A tap on an option
 * asks `onSelect` with its value; the caller changes the sample and the line.
 * The explaining line drops under a sample too wide to leave it room.
 */
export function OptionScreen<T extends string>({
  title,
  subtitle,
  back,
  sample,
  explanation,
  options,
  selected,
  onSelect,
  testID,
}: {
  title: string;
  subtitle: string;
  back: { label: string; onPress: () => void; testID?: string };
  sample: ReactNode;
  explanation: string;
  options: readonly OptionScreenOption<T>[];
  selected: T;
  onSelect: (value: T) => void;
  testID?: string | undefined;
}) {
  const tokens = useTokens();
  const { colors, radii } = tokens;
  const { voice } = useEdition();
  return (
    <ScrollView testID={testID} contentContainerStyle={styles.content}>
      <BackHeader titleRole="settingsSubTitle" title={title} back={back} />
      <Text {...voice} style={[typeStyle('sub', tokens), { color: colors.muted }]}>
        {subtitle}
      </Text>
      <View
        testID={testID === undefined ? undefined : `${testID}-sample`}
        style={[styles.card, { backgroundColor: colors.surfaceSunken, borderRadius: radii.card }]}
      >
        {sample}
        <Text
          {...voice}
          testID={testID === undefined ? undefined : `${testID}-explanation`}
          style={[styles.explanation, typeStyle('sub', tokens), { color: colors.muted }]}
        >
          {explanation}
        </Text>
      </View>
      <SettingsGroup>
        {options.map((option) => (
          <Option
            key={option.value}
            label={option.label}
            on={option.value === selected}
            testID={option.testID}
            onPress={() => {
              onSelect(option.value);
            }}
          />
        ))}
      </SettingsGroup>
    </ScrollView>
  );
}

/** The large sample of an option screen drawn as a number in the accent, such as the Daily Goal's «25». */
export function OptionSampleNumber({ value }: { value: string }) {
  const tokens = useTokens();
  return (
    <Text style={[typeStyle('optionSample', tokens), { color: tokens.colors.accent }]}>
      {value}
    </Text>
  );
}

/**
 * The large sample of an option screen drawn as a Word, its Lemma over its
 * Definition at the Word text sizes in effect, such as «Заграва» on
 * «Шрифт і розмір»: the caller sets the size it shows with a `FontSizeProvider`.
 */
export function OptionSampleWord({ lemma, definition }: { lemma: string; definition: string }) {
  const tokens = useTokens();
  const lemmaSize = useLemmaSize();
  const { definition: definitionSize } = useWordTextSizes();
  return (
    <View style={styles.word}>
      <WholeWordsText
        testID="option-sample-lemma"
        text={lemma}
        size={lemmaSize}
        typeRole="heroWord"
        style={[typeStyle('heroWord', tokens), { color: tokens.colors.ink }]}
      />
      <Text
        testID="option-sample-definition"
        style={[typeStyle('definition', tokens), definitionSize, { color: tokens.colors.ink }]}
      >
        {definition}
      </Text>
    </View>
  );
}

/** An option's row: its label in the middle and its mark at the end, read by VoiceOver as a radio. */
function Option({
  label,
  on,
  testID,
  onPress,
}: {
  label: string;
  on: boolean;
  testID?: string | undefined;
  onPress: () => void;
}) {
  const tokens = useTokens();
  const { colors } = tokens;
  const { voice } = useEdition();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ selected: on }}
      {...voice}
      onPress={onPress}
      style={({ pressed }) => [styles.option, pressed && { backgroundColor: colors.surfaceSunken }]}
    >
      <Text style={[styles.label, typeStyle('optionLabel', tokens), { color: colors.ink }]}>
        {label}
      </Text>
      <ChoiceMark kind="checkbox" on={on} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: space[4], paddingBottom: space[8], gap: space[4] },
  card: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: drawing.sampleGap,
    padding: drawing.samplePadding,
  },
  explanation: { flex: 1, minWidth: drawing.explanationMinWidth },
  // A Word sample takes the card's whole width, so the explaining line drops under it.
  word: { width: '100%', gap: space[2] },
  option: {
    minHeight: minTouchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingHorizontal: space[4],
    paddingVertical: drawing.optionPaddingVertical,
  },
  label: { flex: 1, textAlign: 'center' },
});
