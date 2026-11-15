import { COLLECTION_NAME_MAX_LENGTH, collectionNameLength } from '@slovo/core';

import { useEdition } from '../providers/EditionProvider';
import { NameSheet } from '../primitives/NameSheet';

/**
 * The sheet that names a Collection (board 09), for a new one («Нова
 * колекція», «Створити») or the one being renamed («Перейменувати», the field
 * filled, «Зберегти»): the shared {@link NameSheet}, its counter «N/40»
 * counted as the Core's name rules count.
 */
export function CollectionNameSheet({
  visible,
  kind,
  initialName = '',
  onSubmit,
  onClose,
  onDismissed,
  testID = 'collection-name',
}: {
  visible: boolean;
  kind: 'new' | 'rename';
  initialName?: string | undefined;
  /** Resolves to the reason the name is refused, in the Edition's words, or to nothing once it is kept. */
  onSubmit: (name: string) => Promise<string | undefined>;
  onClose: () => void;
  onDismissed?: (() => void) | undefined;
  testID?: string;
}) {
  const { nameSheet, sheet } = useEdition().strings.collections;
  return (
    <NameSheet
      visible={visible}
      title={kind === 'new' ? nameSheet.newTitle : nameSheet.renameTitle}
      placeholder={sheet.namePlaceholder}
      submitLabel={kind === 'new' ? nameSheet.create : nameSheet.save}
      cancelLabel={nameSheet.cancel}
      counter={nameSheet.counter}
      max={COLLECTION_NAME_MAX_LENGTH}
      lengthOf={collectionNameLength}
      initialName={initialName}
      onSubmit={onSubmit}
      onClose={onClose}
      onDismissed={onDismissed}
      failure="Could not keep the name of the Collection"
      testID={testID}
    />
  );
}
