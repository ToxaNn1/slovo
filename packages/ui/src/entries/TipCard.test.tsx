import type { TipCardModel, TipFeedCard } from '@slovo/core';
import { EditionProvider, EntryCard } from '@slovo/ui';
import { describe, expect, it } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { testStrings } from '../test-strings';
import { titleScale, typeRoles } from '../tokens';

const strings = testStrings({
  wordCard: {
    tabs: { essence: 'Essence', example: 'Example', links: 'Links', history: 'History' },
    tabMore: 'More',
    tabLess: 'Less',
    tabSource: 'Source',
    reveal: 'Show the meaning',
    example: '{text}',
    exampleAuthor: '— {author}',
  },
  correctionCard: {
    tabs: { better: 'Better', why: 'Why', examples: 'Examples' },
    nonStandard: 'Often said',
    standard: 'Better',
    source: 'Source: {source}',
    reveal: 'Show',
  },
  tipCard: {
    chip: 'tip',
    heading: 'Tip: {title}',
    tabs: { rule: 'Rule', exceptions: 'Exceptions' },
  },
  knowledge: { known: 'Known', unknown: 'Unknown' },
});

const model: TipCardModel = {
  kind: 'tip',
  tipId: 't_time',
  title: 'What time is it?',
  nonStandardForm: 'How much is the time?',
  standardForm: 'What time is it?',
  explanation: 'Time is asked by its hour, not by its amount.',
  example: { text: 'Excuse me, what time is it?' },
  exceptions: undefined,
  sourceNames: ['A style guide', 'A dictionary of usage'],
};

const card: TipFeedCard = { kind: 'tip', entryId: 't_time', model };

/** A Tip that shows only the right way, with no wrong form. */
const withoutNonStandard: TipFeedCard = {
  ...card,
  model: { ...model, nonStandardForm: undefined, example: undefined, sourceNames: [] },
};

function inEdition(children: React.ReactNode) {
  return (
    <EditionProvider edition={{ locale: 'en' }} strings={strings}>
      {children}
    </EditionProvider>
  );
}

describe('the Tip card', () => {
  it('shows the kicker, the title over its red bar and the non-standard form over the rule tab', async () => {
    await render(inEdition(<EntryCard card={card} />));

    expect(screen.getByTestId('tip-card')).toBeTruthy();
    expect(screen.getByTestId('tip-title')).toHaveTextContent('What time is it?');
    expect(screen.getByTestId('tip-kicker')).toHaveTextContent('tip');
    expect(screen.getByTestId('tip-rule')).toBeTruthy();
    expect(screen.getByTestId('tip-non-standard')).toHaveProp(
      'accessibilityLabel',
      'Often said: How much is the time?',
    );
    expect(screen.getByTestId('tip-explanation')).toHaveTextContent(
      'Time is asked by its hour, not by its amount.',
    );
  });

  it('shows only the rule when the Tip has no non-standard form', async () => {
    await render(inEdition(<EntryCard card={withoutNonStandard} />));

    expect(screen.queryByTestId('tip-non-standard')).toBeNull();
    expect(screen.queryByText('Often said')).toBeNull();
    expect(screen.getByTestId('tip-explanation')).toBeTruthy();
    expect(screen.getByTestId('tip-word-0')).toHaveTextContent('What time is it?');
    expect(screen.queryByTestId('tip-word-1')).toBeNull();
    expect(screen.queryByTestId('tip-source')).toBeNull();
  });

  it('reads the title, then the non-standard form under its label, to VoiceOver', async () => {
    await render(inEdition(<EntryCard card={card} />));

    expect(screen.getByRole('header', { name: 'Tip: What time is it?' })).toBeTruthy();
    expect(screen.getByLabelText('Often said: How much is the time?')).toBeTruthy();
  });
});

describe('the Tip card with the Source tab (ADR 0116)', () => {
  it('moves the sources out of the rule tab into a last tab, so the bar reads Rule · Source', async () => {
    await render(inEdition(<EntryCard card={card} sourceTab />));

    expect(
      screen.getAllByRole('tab').map((tab) => tab.props['accessibilityLabel'] as string),
    ).toEqual(['Rule', 'Source']);
    expect(screen.getByTestId('tip-explanation')).toBeTruthy();
    expect(screen.queryByTestId('tip-source')).toBeNull();

    await fireEvent.press(screen.getByTestId('tip-tab-source'));

    expect(screen.getByTestId('tip-source-0')).toHaveTextContent('A style guide', { exact: true });
    expect(screen.getByTestId('tip-source-1')).toHaveTextContent('A dictionary of usage', {
      exact: true,
    });
  });

  it('shows the exceptions of a Tip in a tab after the rule, their text and their words in chips', async () => {
    const exceptions = { explanation: 'Not on the hour itself:', words: ['noon', 'midnight'] };
    const withExceptions: TipFeedCard = { ...card, model: { ...model, exceptions } };
    await render(inEdition(<EntryCard card={withExceptions} sourceTab tipExceptions />));

    expect(
      screen.getAllByRole('tab').map((tab) => tab.props['accessibilityLabel'] as string),
    ).toEqual(['Rule', 'Exceptions', 'Source']);

    await fireEvent.press(screen.getByTestId('tip-tab-exceptions'));

    expect(screen.getByTestId('tip-exceptions')).toHaveTextContent('Not on the hour itself:');
    expect(screen.getByTestId('tip-exception-word-0')).toHaveTextContent('Noon');
    expect(screen.getByTestId('tip-exception-word-1')).toHaveTextContent('Midnight');
    expect(screen.queryByTestId('tip-source')).toBeNull();
  });

  it('keeps the exceptions out while their Feature Switch is off', async () => {
    const exceptions = { explanation: 'Not on the hour itself:', words: ['noon'] };
    const withExceptions: TipFeedCard = { ...card, model: { ...model, exceptions } };
    await render(inEdition(<EntryCard card={withExceptions} sourceTab />));

    expect(screen.queryByTestId('tip-tab-exceptions')).toBeNull();
  });

  it('keeps one tab and no bar for a Tip without sources', async () => {
    await render(inEdition(<EntryCard card={withoutNonStandard} sourceTab />));

    expect(screen.queryByRole('tablist')).toBeNull();
  });
});

describe('the Tip card in tabs (board e9)', () => {
  it('starts the title at its own title size and line', async () => {
    await render(inEdition(<EntryCard card={card} />));

    expect(screen.getByTestId('tip-title')).toHaveStyle({
      fontSize: typeRoles.tipTitle.size,
      lineHeight: typeRoles.tipTitle.lineHeight,
    });
  });

  it('keeps «Often said» over the rule tab: the explanation, a chip of the standard form and of the Example, and the sources', async () => {
    await render(inEdition(<EntryCard card={card} />));

    expect(screen.getByLabelText('Often said: How much is the time?')).toBeTruthy();
    expect(screen.queryByRole('tablist')).toBeNull();
    expect(screen.getByTestId('tip-explanation')).toHaveStyle({
      fontSize: typeRoles.tipRule.size,
      lineHeight: typeRoles.tipRule.lineHeight,
    });
    expect(screen.getByTestId('tip-word-0')).toHaveTextContent('What time is it?');
    expect(screen.getByTestId('tip-word-1')).toHaveTextContent('Excuse me, what time is it?');
    expect(screen.queryByTestId('tip-standard')).toBeNull();
    expect(screen.queryByTestId('tip-example')).toBeNull();
    expect(screen.getByTestId('tip-source')).toHaveTextContent(
      'Source: A style guide; A dictionary of usage',
    );
  });

  it('shows only the title and the non-standard form under Self-check, the rule empty until the reveal', async () => {
    await render(inEdition(<EntryCard card={card} selfCheck />));

    expect(screen.getByLabelText('Often said: How much is the time?')).toBeTruthy();
    expect(screen.queryByTestId('tip-explanation')).toBeNull();
    expect(screen.queryByTestId('tip-word-0')).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Show' }));

    expect(screen.getByTestId('tip-explanation')).toBeTruthy();
  });
});

describe('Self-check on a Tip card', () => {
  it('shows only the title until the reveal when the Tip has no non-standard form', async () => {
    await render(inEdition(<EntryCard card={withoutNonStandard} selfCheck />));

    expect(screen.getByRole('header', { name: 'Tip: What time is it?' })).toBeTruthy();
    expect(screen.queryByTestId('tip-non-standard')).toBeNull();
    expect(screen.queryByTestId('tip-explanation')).toBeNull();
    expect(screen.queryByTestId('tip-word-0')).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Show' }));

    expect(screen.getByTestId('tip-explanation')).toBeTruthy();
    expect(screen.getByTestId('tip-word-0')).toHaveTextContent('What time is it?');
  });
});

describe('the texts of a Tip card', () => {
  it('start with a capital, whatever case the content has (owner decision 11)', async () => {
    const lowercase: TipFeedCard = {
      ...card,
      model: {
        ...model,
        title: 'what time is it?',
        nonStandardForm: 'how much is the time?',
        standardForm: 'what time is it?',
        explanation: 'time is asked by its hour.',
        example: { text: 'excuse me, what time is it?' },
      },
    };
    await render(inEdition(<EntryCard card={lowercase} />));

    expect(screen.getByTestId('tip-title')).toHaveTextContent('What time is it?');
    expect(screen.getByTestId('tip-non-standard')).toHaveTextContent(/How much is the time\?/);
    expect(screen.getByTestId('tip-explanation')).toHaveTextContent('Time is asked by its hour.');
    expect(screen.getByTestId('tip-word-0')).toHaveTextContent('What time is it?');
    expect(screen.getByTestId('tip-word-1')).toHaveTextContent('Excuse me, what time is it?');
  });
});

describe('a long Tip title', () => {
  it('takes the next lower step of the title scale for its widest word to fit a line, in three lines at most', async () => {
    const title = 'Interregional, intercontinental and international meetings';
    await render(inEdition(<EntryCard card={{ ...card, model: { ...model, title } }} />));
    const shown = screen.getByTestId('tip-title');
    const line = shown.parent;
    if (line === null) throw new Error('The title has no line around it');
    await fireEvent(line, 'layout', { nativeEvent: { layout: { width: 301 } } });
    const words = () => screen.getByTestId('tip-title-words', { includeHiddenElements: true });
    // Every word measured on its own line: at the title's size the widest is too wide, a step lower it fits.
    await fireEvent(words(), 'textLayout', { nativeEvent: { lines: [{ width: 330 }] } });
    await fireEvent(words(), 'textLayout', { nativeEvent: { lines: [{ width: 300 }] } });
    await fireEvent(
      screen.getByTestId('tip-title-lines', { includeHiddenElements: true }),
      'textLayout',
      { nativeEvent: { lines: [{ width: 290 }, { width: 290 }, { width: 120 }] } },
    );

    const { size, lineHeight } = typeRoles.tipTitle;
    // The title scale runs from the largest down, so the next lower step is the first below.
    const lower = titleScale.find((step) => step < size);
    if (lower === undefined) throw new Error('No lower step on the title scale');
    const fitted = screen.getByTestId('tip-title');
    expect(fitted).toHaveStyle({ fontSize: lower, lineHeight: lineHeight * (lower / size) });
    expect(fitted).not.toHaveStyle({ opacity: 0 });
    expect(fitted.props).toMatchObject({ numberOfLines: 3, adjustsFontSizeToFit: true });
  });
});
