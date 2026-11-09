import { describe, expect, it } from '@jest/globals';
import type { CorrectionTypeRow } from '@slovo/core';
import { act, renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { ShellProvider } from '../shell-value';
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
    const wrapper = ({ children }: { children: ReactNode }) => (
      <ShellProvider shell={shell}>{children}</ShellProvider>
    );
    const hook = await renderHook(() => useCorrectionTypeScreen('surzhyk'), { wrapper });
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
