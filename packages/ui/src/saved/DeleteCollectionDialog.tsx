import { fill } from '../providers/EditionProvider';
import { ConfirmationDialog } from '../primitives/ConfirmationDialog';

/**
 * The question before a Collection is deleted, in the SLOVO confirmation
 * dialog: it shows while `name` is the Collection being asked about, and says
 * its Entries stay. The caller clears `name` in both callbacks.
 */
export function DeleteCollectionDialog({
  name,
  copy,
  onDelete,
  onCancel,
  testID,
}: {
  /** The name of the Collection being asked about; nothing hides the dialog. */
  name: string | undefined;
  copy: {
    /** Takes `{name}`. */
    title: string;
    message: string;
    confirm: string;
    cancel: string;
  };
  onDelete: () => void;
  onCancel: () => void;
  testID?: string | undefined;
}) {
  return (
    <ConfirmationDialog
      visible={name !== undefined}
      title={fill(copy.title, { name: name ?? '' })}
      message={copy.message}
      destructiveLabel={copy.confirm}
      cancelLabel={copy.cancel}
      onDestructive={onDelete}
      onCancel={onCancel}
      testID={testID}
    />
  );
}
