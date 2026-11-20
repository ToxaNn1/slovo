import { describe, expect, it } from '@jest/globals';
import type { CorrectionTypeRow } from '@slovo/core';
import { act } from '@testing-library/react-native';

import { renderHookInApp } from '../shell/test-app';
import { opened, testShell } from '../shell/test-support';
import { useCorrectionTypeScreen } from './correction-type';

describe('the Correction Type screen', () => {
  it('shows the rows of the newer read when an older one ends after it', async () => {
    const reads: ((rows: readonly CorrectionTypeRow[]) => void)[] = [];
    let tell: () => void = () => undefined;
    const composition = await testShell().composition.opened();
    const shell = testShell({
      composition: opened({
        ...composition,
        correctionTypes: {
          ...composition.correctionTypes,
          corrections: () =>
            new Promise<readonly CorrectionTypeRow[]>((resolve) => {
              reads.push(resolve);
            }),
          subscribe: (listener: () => void) => {
            tell = listener;
            return () => undefined;
          },
        },
      }),
    });
    const hook = await renderHookInApp(() => useCorrectionTypeScreen('surzhyk'), { shell });
    const older: readonly CorrectionTypeRow[] = [];
    const newer: readonly CorrectionTypeRow[] = [];

    await act(async () => {
      tell();
      reads[1]?.(newer);
      await Promise.resolve();
      reads[0]?.(older);
      await Promise.resolve();
    });

    expect(reads).toHaveLength(2);
    expect(hook.result.current.rows).toBe(newer);
  });
});
