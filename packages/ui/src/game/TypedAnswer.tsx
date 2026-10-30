import { StyleSheet, Text, TextInput, View } from 'react-native';

import { useEdition } from '../providers/EditionProvider';
import { PrimaryButton } from '../primitives/PrimaryButton';
import { SecondaryButton } from '../primitives/SecondaryButton';
import { minTouchTarget, roundLayout, space, typeSize } from '../tokens';
import { useTokens } from '../providers/TokensProvider';

/** A blank's width and the thickness of the line it stands on. */
const BLANK_WIDTH = 28;
const BLANK_LINE = 2;
/** A blank's letter size (the Round's option size). */
const BLANK_SIZE = { fontSize: typeSize.roundOption, lineHeight: typeSize.roundOption * 1.3 };
/** How far the largest text sizes of iOS may scale a blank's letter, so the row keeps its shape. */
const BLANK_MAX_FONT_SCALE = 1.5;

/**
 * One place of the Word to type, in order: an apostrophe or a hyphen, which
 * stays in place and is never a blank, or a letter's blank, with its letter
 * once it is open.
 */
export type TypedAnswerBlank = { readonly mark: string } | { readonly letter?: string };

/**
 * A typed Round's answer: the Word's blanks, if the Round shows them, a text
 * field and its submit button, and «Відкрити літеру» if the Round offers it,
 * which opens no letter once one is left. The screen keeps what is typed and
 * which letters are open (the Core decides them) and passes the texts.
 */
export function TypedAnswer({
  value,
  onChangeText,
  onSubmit,
  blanks,
  onOpenLetter,
  texts,
  testID,
}: {
  value: string;
  onChangeText: (text: string) => void;
  /** Called with something besides spaces typed, by the button or the keyboard's return key. */
  onSubmit: () => void;
  /** The Word's places, in order; no blanks are shown without them. */
  blanks?: readonly TypedAnswerBlank[] | undefined;
  /** Opens one more letter; no «Відкрити літеру» without it. */
  onOpenLetter?: (() => void) | undefined;
  /** The Edition's texts. */
  texts: {
    /** The field's placeholder, which VoiceOver reads as its name. */
    label: string;
    submit: string;
    /** «Відкрити літеру». */
    openLetter: string;
    /** What VoiceOver reads for a blank: its place among the letters from 0, and its letter once open. */
    blankLabel: (place: number, letter: string | undefined) => string;
  };
  testID: string;
}) {
  const { colors, fontFamilies, radii } = useTokens();
  const { voice } = useEdition();
  const typed = value.trim() !== '';
  const closed = blanks?.filter((blank) => !('mark' in blank) && blank.letter === undefined);
  const submit = () => {
    if (typed) onSubmit();
  };

  return (
    <View style={styles.answer}>
      {blanks !== undefined && (
        <Blanks blanks={blanks} blankLabel={texts.blankLabel} testID={`${testID}-blanks`} />
      )}
      <View
        style={[
          styles.box,
          { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: radii.button },
        ]}
      >
        <TextInput
          testID={testID}
          accessibilityLabel={texts.label}
          placeholder={texts.label}
          {...voice}
          value={value}
          onChangeText={onChangeText}
          onSubmitEditing={submit}
          returnKeyType="done"
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          placeholderTextColor={colors.muted}
          selectionColor={colors.accent}
          style={[styles.input, { color: colors.ink, fontFamily: fontFamilies.word }]}
        />
      </View>
      {onOpenLetter !== undefined && (
        <SecondaryButton
          label={texts.openLetter}
          onPress={onOpenLetter}
          disabled={closed === undefined || closed.length <= 1}
          testID={`${testID}-open-letter`}
        />
      )}
      <PrimaryButton
        label={texts.submit}
        onPress={submit}
        disabled={!typed}
        testID={`${testID}-submit`}
      />
    </View>
  );
}

/** The Word's blanks in a row, each letter's read by VoiceOver with its place; a mark is skipped. */
function Blanks({
  blanks,
  blankLabel,
  testID,
}: {
  blanks: readonly TypedAnswerBlank[];
  blankLabel: (place: number, letter: string | undefined) => string;
  testID: string;
}) {
  const { colors, fontFamilies } = useTokens();
  const { voice } = useEdition();
  const letterStyle = [
    BLANK_SIZE,
    styles.letter,
    { color: colors.ink, fontFamily: fontFamilies.word },
  ];
  return (
    <View testID={testID} style={styles.blanks}>
      {placeBlanks(blanks).map((blank, index) => {
        if ('mark' in blank)
          return (
            <Text
              key={index}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              maxFontSizeMultiplier={BLANK_MAX_FONT_SCALE}
              style={letterStyle}
            >
              {blank.mark}
            </Text>
          );
        const label = blankLabel(blank.place, blank.letter);
        return (
          <View
            key={index}
            accessible
            accessibilityLabel={label}
            {...voice}
            style={[styles.blank, { borderBottomColor: colors.ink }]}
          >
            <Text maxFontSizeMultiplier={BLANK_MAX_FONT_SCALE} style={letterStyle}>
              {blank.letter ?? ' '}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

/** Each letter blank with its place among the letters, so a mark takes no place. */
function placeBlanks(
  blanks: readonly TypedAnswerBlank[],
): ({ readonly mark: string } | { readonly letter?: string; readonly place: number })[] {
  let letters = 0;
  return blanks.map((blank) => ('mark' in blank ? blank : { ...blank, place: letters++ }));
}

const styles = StyleSheet.create({
  answer: { gap: roundLayout.gap },
  blanks: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'flex-end',
    gap: roundLayout.tightGap,
    paddingVertical: space[2],
  },
  blank: { minWidth: BLANK_WIDTH, alignItems: 'center', borderBottomWidth: BLANK_LINE },
  letter: { fontWeight: '500', textAlign: 'center' },
  box: {
    minHeight: minTouchTarget + space[2],
    justifyContent: 'center',
    paddingHorizontal: space[4],
    borderWidth: 1,
  },
  input: { alignSelf: 'stretch', fontSize: typeSize.listItem },
});
