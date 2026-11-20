import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
import { EditionProvider } from '@slovo/ui';
import { testStrings } from '../test-strings';
import { ExampleText } from './WordCard';

const strings = testStrings({ wordCard: { example: '«{text}»', exampleAuthor: '— {author}' } });

const renderExample = async (text: string) => {
  await render(
    <EditionProvider edition={{ locale: 'en' }} strings={strings}>
      <ExampleText
        example={{ text, author: 'An Author' }}
        size={{ fontSize: 16, lineHeight: 22 }}
        testID="example"
      />
    </EditionProvider>,
  );
};

describe('ExampleText as VoiceOver reads it', () => {
  it('reads a quoted Example ending in its own full stop with no comma before the author', async () => {
    await renderExample('The wood rustled.');
    expect(screen.getByTestId('example')).toHaveProp(
      'accessibilityLabel',
      '«The wood rustled.» — An Author',
    );
  });

  it('puts a comma before the author after a quoted Example with no full stop of its own', async () => {
    await renderExample('The wood rustled');
    expect(screen.getByTestId('example')).toHaveProp(
      'accessibilityLabel',
      '«The wood rustled», — An Author',
    );
  });
});
