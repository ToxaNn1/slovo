import { useState } from 'react';

import { ConfirmationDialog } from '../primitives/ConfirmationDialog';
import { SecondaryButton } from '../primitives/SecondaryButton';

/**
 * The destructive «Видалити SLOVO ID» button of the SLOVO ID screen. A press
 * asks first, with the SLOVO confirmation dialog, and `onDelete` runs only
 * when the reader confirms.
 */
export function DeleteAccountButton({
  copy,
  onDelete,
  busy,
  disabled,
  testID,
}: {
  copy: {
    /** The label of the button. */
    button: string;
    title: string;
    message: string;
    confirm: string;
    cancel: string;
  };
  onDelete: () => void;
  /** Whether the deletion is on the way. */
  busy?: boolean | undefined;
  disabled?: boolean | undefined;
  testID?: string | undefined;
}) {
  const [asking, setAsking] = useState(false);
  return (
    <>
      <SecondaryButton
        testID={testID}
        label={copy.button}
        destructive
        busy={busy}
        disabled={disabled}
        onPress={() => {
          setAsking(true);
        }}
      />
      <ConfirmationDialog
        visible={asking}
        title={copy.title}
        message={copy.message}
        destructiveLabel={copy.confirm}
        cancelLabel={copy.cancel}
        onDestructive={() => {
          setAsking(false);
          onDelete();
        }}
        onCancel={() => {
          setAsking(false);
        }}
        testID={testID === undefined ? undefined : `${testID}-dialog`}
      />
    </>
  );
}
