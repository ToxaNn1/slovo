import { describe, expect, it } from '@jest/globals';
import { coreTokens, CorrectionTypesRail, EditionProvider, TokensProvider } from '@slovo/ui';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { testStrings } from '../test-strings';
import { typeRoles } from '../tokens';

describe('CorrectionTypesRail with a long name', () => {
  it('draws the name small enough for it to fit the tile whole, never splitting it', async () => {
    await render(
      <TokensProvider tokens={coreTokens} colorScheme="light">
        <EditionProvider
          edition={{ locale: 'en' }}
          strings={testStrings({
            dashboard: {
              correctionTypes: {
                title: 'Corrections',
                tiles: { officialese: 'Bureaucratese' },
              },
            },
          })}
        >
          <CorrectionTypesRail
            tiles={[{ type: 'officialese', total: 3, workedThrough: 0 }]}
            onOpen={() => undefined}
          />
        </EditionProvider>
      </TokensProvider>,
    );
    const name = screen.getByTestId('dashboard-correction-type-officialese-name');
    const line = name.parent;
    if (line === null) throw new Error('The name has no line around it');
    await fireEvent(line, 'layout', { nativeEvent: { layout: { width: 101 } } });
    // The word measured at full size: twice as wide as the tile has room for, less a point.
    const measured = screen
      .getAllByText('Bureaucratese', { includeHiddenElements: true })
      .find((text) => text !== name);
    if (measured === undefined) throw new Error('The name is not measured');
    await fireEvent(measured, 'textLayout', { nativeEvent: { lines: [{ width: 200 }] } });

    expect(name).toHaveTextContent('Bureaucratese');
    expect(name).toHaveStyle({ fontSize: typeRoles.correctionName.size / 2 });
    expect(name).not.toHaveStyle({ opacity: 0 });
  });
});
