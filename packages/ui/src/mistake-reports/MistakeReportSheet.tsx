import { REPORT_COMMENT_LENGTH, type MistakeType } from '@slovo/contracts';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { BottomSheet } from '../primitives/BottomSheet';
import { PrimaryButton } from '../primitives/PrimaryButton';
import { SHEET_ROW_HEIGHT, SheetTitle } from '../primitives/SheetParts';
import { useEdition } from '../providers/EditionProvider';
import { useTokens } from '../providers/TokensProvider';
import { minTouchTarget, space, typeSize } from '../tokens';

/** The types of mistake in the order the sheet offers them. */
const TYPES: readonly MistakeType[] = ['typo', 'stress', 'definition', 'other'];

/** The radio mark's side, the size of the Collections sheet's checkbox. */
const RADIO_SIZE = 26;

/** How many lines of the comment show before it scrolls. */
const COMMENT_LINES = 4;

/** What the reader wrote in the sheet: the type and the comment as typed. */
export interface MistakeReportSheetDraft {
  readonly type: MistakeType;
  readonly comment: string;
}

/**
 * The sheet of «Повідомити про помилку» (ADR 0056): the type of the mistake,
 * one of four and required; «Коментар (необов'язково)» with a counter that
 * stops at 500 characters; and «Надіслати», disabled until a type is chosen,
 * and for «Інше» until the comment says something. «Надіслати» hands the
 * draft to `onSend` and the sheet starts afresh; a tap on the scrim, a drag on
 * the grabber and VoiceOver's escape gesture ask `onClose`, and keep what was
 * written. The caller turns `visible` off in both callbacks. Needs a
 * `SafeAreaProvider` above it.
 */
export function MistakeReportSheet({
  visible,
  onSend,
  onClose,
  testID = 'mistake-report',
}: {
  visible: boolean;
  onSend: (draft: MistakeReportSheetDraft) => void;
  onClose: () => void;
  testID?: string;
}) {
  const { colors, fontFamilies, radii } = useTokens();
  const { strings, voice } = useEdition();
  const sheet = strings.mistakeReport;
  const [type, setType] = useState<MistakeType | undefined>(undefined);
  const [comment, setComment] = useState('');
  const ready = type !== undefined && (type !== 'other' || comment.trim() !== '');

  return (
    <BottomSheet visible={visible} onClose={onClose} testID={testID}>
      <View style={styles.header}>
        <SheetTitle>{sheet.action}</SheetTitle>
      </View>
      <View accessibilityRole="radiogroup">
        {TYPES.map((key, index) => {
          const chosen = key === type;
          return (
            <Pressable
              key={key}
              testID={`${testID}-type-${key}`}
              accessibilityRole="radio"
              accessibilityState={{ checked: chosen }}
              accessibilityLabel={sheet.types[key]}
              {...voice}
              onPress={() => {
                setType(key);
              }}
              style={[
                styles.row,
                index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
              ]}
            >
              <View style={[styles.radio, { borderColor: chosen ? colors.accent : colors.muted }]}>
                {chosen && <View style={[styles.dot, { backgroundColor: colors.accent }]} />}
              </View>
              <Text
                {...voice}
                style={[styles.type, { color: colors.ink, fontFamily: fontFamilies.ui }]}
              >
                {sheet.types[key]}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.comment}>
        <View style={styles.commentHeader}>
          {/* The field below says the same name to VoiceOver, so this line is not read twice. */}
          <Text
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={[styles.label, { color: colors.muted, fontFamily: fontFamilies.ui }]}
          >
            {sheet.comment}
          </Text>
          <Text
            testID={`${testID}-count`}
            style={[styles.label, { color: colors.muted, fontFamily: fontFamilies.ui }]}
          >
            {`${String(comment.length)}/${String(REPORT_COMMENT_LENGTH)}`}
          </Text>
        </View>
        <TextInput
          testID={`${testID}-comment`}
          accessibilityLabel={sheet.comment}
          {...voice}
          value={comment}
          onChangeText={(text) => {
            setComment(text.slice(0, REPORT_COMMENT_LENGTH));
          }}
          maxLength={REPORT_COMMENT_LENGTH}
          multiline
          numberOfLines={COMMENT_LINES}
          autoCapitalize="sentences"
          selectionColor={colors.accent}
          style={[
            styles.field,
            {
              backgroundColor: colors.surface,
              borderColor: colors.line,
              borderRadius: radii.button,
              color: colors.ink,
              fontFamily: fontFamilies.ui,
            },
          ]}
        />
      </View>
      <View style={styles.send}>
        <PrimaryButton
          testID={`${testID}-send`}
          label={sheet.send}
          disabled={!ready}
          onPress={() => {
            if (type === undefined || !ready) return;
            onSend({ type, comment });
            setType(undefined);
            setComment('');
          }}
        />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  header: { paddingBottom: space[3] },
  row: {
    minHeight: SHEET_ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[4],
    paddingVertical: space[2],
  },
  radio: {
    width: RADIO_SIZE,
    height: RADIO_SIZE,
    borderRadius: RADIO_SIZE / 2,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: { width: RADIO_SIZE / 2, height: RADIO_SIZE / 2, borderRadius: RADIO_SIZE / 4 },
  type: { flex: 1, fontSize: typeSize.listItem, fontWeight: '600' },
  comment: { marginTop: space[3], gap: space[2] },
  commentHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: space[3] },
  label: { fontSize: typeSize.caption, fontWeight: '600' },
  field: {
    minHeight: minTouchTarget * 2,
    borderWidth: 1,
    paddingHorizontal: space[4],
    paddingTop: space[3],
    paddingBottom: space[3],
    fontSize: typeSize.listItem,
    textAlignVertical: 'top',
  },
  send: { marginTop: space[4] },
});
