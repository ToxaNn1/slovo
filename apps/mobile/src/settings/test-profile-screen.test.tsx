import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { EditionProvider } from '@slovo/ui';
import { act, fireEvent, screen } from '@testing-library/react-native';

import { edition, editionStrings } from '../edition/edition';
import { renderInGestureRoot } from '../shell/test-render';
import type { TestProfileName } from '../user-state/test-states';
import { TestProfileList } from './test-profile-screen';

/** The list as Settings › «Тестовий профіль» draws it, with the loads it asks for kept. */
async function renderList(guest: boolean) {
  const loads: TestProfileName[] = [];
  await renderInGestureRoot(
    <EditionProvider edition={edition} strings={editionStrings}>
      <TestProfileList
        guest={guest}
        load={(name) => {
          loads.push(name);
          return Promise.resolve();
        }}
      />
    </EditionProvider>,
  );
  return loads;
}

describe('«Тестовий профіль»', () => {
  const sent: unknown[] = [];
  const realFetch = global.fetch;
  beforeEach(() => {
    sent.length = 0;
    global.fetch = (input) => {
      sent.push(input);
      return Promise.reject(new Error('No request leaves a test profile.'));
    };
  });
  afterEach(() => {
    global.fetch = realFetch;
  });

  it('offers a guest the three profiles, and a press loads its own at once, sending nothing', async () => {
    const loads = await renderList(true);

    expect(screen.getByText('Чистий')).toBeTruthy();
    expect(screen.getByText('Пів року')).toBeTruthy();
    await act(() => fireEvent.press(screen.getByTestId('test-profile-week')));

    expect(loads).toEqual(['week']);
    expect(screen.getByTestId('test-profile-loading')).toBeTruthy();
    expect(sent).toEqual([]);
  });

  it('loads one profile per press while it loads', async () => {
    const loads = await renderList(true);

    await act(() => fireEvent.press(screen.getByTestId('test-profile-clean')));
    await act(() => fireEvent.press(screen.getByTestId('test-profile-half-year')));

    expect(loads).toEqual(['clean']);
  });

  it('offers nothing while signed in, so no profile reaches the Account', async () => {
    const loads = await renderList(false);

    expect(screen.getByTestId('test-profile-signed-in')).toBeTruthy();
    expect(screen.queryByTestId('test-profile-week')).toBeNull();
    expect(loads).toEqual([]);
  });
});
