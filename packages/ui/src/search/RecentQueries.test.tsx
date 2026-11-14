import { EditionProvider, RecentQueries } from '@slovo/ui';
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { testStrings } from '../test-strings';

describe('RecentQueries', () => {
  it('lists the queries in their order and runs one again on a tap', async () => {
    const run = jest.fn();
    await render(
      <EditionProvider edition={{ locale: 'en' }} strings={testStrings({})}>
        <RecentQueries queries={['gre', 'sum']} onRun={run} />
      </EditionProvider>,
    );

    expect(screen.getByTestId('search-recent-0')).toHaveAccessibleName('gre');
    expect(screen.getByTestId('search-recent-1')).toHaveAccessibleName('sum');

    await fireEvent.press(screen.getByRole('button', { name: 'sum' }));

    expect(run).toHaveBeenCalledWith('sum');
  });
});
