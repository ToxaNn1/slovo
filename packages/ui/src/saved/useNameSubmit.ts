import { useRef, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

import { useEdition } from '../providers/EditionProvider';

/**
 * Keeps a Collection's name through `keep`, which resolves to the reason the
 * name is refused, in the Edition's words, or to nothing once it is kept. A
 * second submit while the first is being kept does nothing; a refusal is
 * announced and stays until `clearRefusal`; a failure keeps nothing, is
 * logged as `failure` and shown and announced as the Edition's `nameFailed`,
 * so the reader can try again.
 */
export function useNameSubmit(
  keep: (name: string) => Promise<string | undefined>,
  failure: string,
) {
  const { nameFailed } = useEdition().strings.collections.sheet;
  const [refusal, setRefusal] = useState<string>();
  const submitting = useRef(false);

  /** Resolves to whether the name was kept. */
  async function submit(name: string): Promise<boolean> {
    if (submitting.current) return false;
    submitting.current = true;
    try {
      const reason = await keep(name);
      setRefusal(reason);
      if (reason !== undefined) AccessibilityInfo.announceForAccessibility(reason);
      return reason === undefined;
    } catch (error) {
      // Nothing was kept: the field stays as the reader typed it, to try again.
      console.error(failure, error);
      setRefusal(nameFailed);
      AccessibilityInfo.announceForAccessibility(nameFailed);
      return false;
    } finally {
      submitting.current = false;
    }
  }

  return {
    refusal,
    clearRefusal: () => {
      setRefusal(undefined);
    },
    submit,
    /** Whether a name is being kept now. */
    isSubmitting: () => submitting.current,
  };
}
