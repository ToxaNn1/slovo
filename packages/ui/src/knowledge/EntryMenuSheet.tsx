import type { AnyEntryCard, KnowledgeMark } from '@slovo/core';
import { StyleSheet, Text, View } from 'react-native';

import { useConcealed } from '../entries/self-check';
import { BottomSheet } from '../primitives/BottomSheet';
import { Button } from '../primitives/Button';
import { useEdition } from '../providers/EditionProvider';
import { useTokens } from '../providers/TokensProvider';
import { space, typeStyle } from '../tokens';

/** The Knowledge Mark items of the sheet: the Entry's mark now, and what its items do. */
export interface EntryMenuMarks {
  readonly mark: KnowledgeMark | undefined;
  readonly onSet: (mark: KnowledgeMark) => void;
  readonly onClear: () => void;
}

/**
 * The bottom sheet an Entry card's «⋯» button opens (XSwipe), headed by what
 * the Entry's row leads with. Its mark items come first, on their own surface,
 * by the Entry's mark: «Знаю» and «Не знаю» with no mark (a Correction's
 * «Знаю» says «Я й так кажу правильно»), «Змінити на «Не знаю»» or «Змінити на
 * «Знаю»» and «Зняти позначку» with one; they are left out while Self-check
 * conceals the card, and when `marks` is not given. Then «Поділитися»,
 * «Сховати» and «Повідомити про помилку», each when given, and «Скасувати» last.
 * An item asks for its action; the caller closes the sheet. «Скасувати», a tap on
 * the scrim and a drag on its top ask `onClose`; `onDismissed` runs once the
 * sheet has slid away, for a sheet an item opens next.
 */
export function EntryMenuSheet({
  visible,
  entryTitle,
  entryKind,
  marks,
  onShare,
  onHide,
  onReport,
  onClose,
  onDismissed,
  testID = 'entry-menu',
}: {
  visible: boolean;
  entryTitle: string;
  entryKind: AnyEntryCard['kind'];
  marks?: EntryMenuMarks | undefined;
  onShare?: (() => void) | undefined;
  onHide?: (() => void) | undefined;
  onReport?: (() => void) | undefined;
  onClose: () => void;
  onDismissed?: (() => void) | undefined;
  testID?: string;
}) {
  const concealed = useConcealed();
  const { strings, voice } = useEdition();
  const tokens = useTokens();
  const { colors, radii } = tokens;
  const menu = strings.knowledge.swipe.menu;
  const markItems = marks === undefined || concealed ? [] : itemsOf(marks, entryKind, menu);
  return (
    <BottomSheet visible={visible} onClose={onClose} onDismissed={onDismissed} testID={testID}>
      <View style={styles.rows}>
        <Text
          {...voice}
          style={[typeStyle('sheetLemma', tokens), { color: colors.accent }]}
          numberOfLines={2}
          testID={`${testID}-title`}
        >
          {entryTitle}
        </Text>
        {markItems.length > 0 && (
          <View
            style={[
              styles.rows,
              styles.marks,
              { backgroundColor: colors.background, borderRadius: radii.card },
            ]}
          >
            {markItems.map((item) => (
              <Button
                key={item.key}
                variant="neutral"
                label={item.label}
                onPress={item.onPress}
                testID={`${testID}-${item.key}`}
              />
            ))}
          </View>
        )}
        {onShare !== undefined && (
          <Button
            variant="neutral"
            label={menu.share}
            onPress={onShare}
            testID={`${testID}-share`}
          />
        )}
        {onHide !== undefined && (
          <Button variant="neutral" label={menu.hide} onPress={onHide} testID={`${testID}-hide`} />
        )}
        {onReport !== undefined && (
          <Button
            variant="neutral"
            label={menu.report}
            onPress={onReport}
            testID={`${testID}-report`}
          />
        )}
        <Button variant="neutral" label={menu.close} onPress={onClose} testID={`${testID}-close`} />
      </View>
    </BottomSheet>
  );
}

type MenuStrings = ReturnType<typeof useEdition>['strings']['knowledge']['swipe']['menu'];

/** The mark items for the Entry's mark now. */
function itemsOf(
  { mark, onSet, onClear }: EntryMenuMarks,
  entryKind: AnyEntryCard['kind'],
  menu: MenuStrings,
): { key: string; label: string; onPress: () => void }[] {
  const clear = { key: 'clear', label: menu.clear, onPress: onClear };
  if (mark === 'known')
    return [
      {
        key: 'unknown',
        label: menu.changeToUnknown,
        onPress: () => {
          onSet('unknown');
        },
      },
      clear,
    ];
  if (mark === 'unknown')
    return [
      {
        key: 'known',
        label: menu.changeToKnown,
        onPress: () => {
          onSet('known');
        },
      },
      clear,
    ];
  return [
    {
      key: 'known',
      label: entryKind === 'correction' ? menu.marks.correctionKnown : menu.marks.known,
      onPress: () => {
        onSet('known');
      },
    },
    {
      key: 'unknown',
      label: menu.marks.unknown,
      onPress: () => {
        onSet('unknown');
      },
    },
  ];
}

const styles = StyleSheet.create({
  rows: { gap: space[2] },
  marks: { padding: space[2] },
});
