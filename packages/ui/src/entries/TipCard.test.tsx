import type { TipCardModel, TipFeedCard } from '@slovo/core';
import { ActionRow, EditionProvider, EntryCard, KnowledgeButtons } from '@slovo/ui';
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { testStrings } from '../test-strings';

const strings = testStrings({
  wordCard: {
    tabSource: 'Source',
    reveal: 'Show the meaning',
    example: '{text}',
    exampleAuthor: '— {author}',
  },
  correctionCard: {
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
  it('shows the kicker, the title over its red bar, both forms under the Correction card labels, the explanation, the example and the sources', async () => {
    await render(inEdition(<EntryCard card={card} />));

    expect(screen.getByTestId('tip-card')).toBeTruthy();
    expect(screen.getByTestId('tip-title')).toHaveTextContent('What time is it?');
    expect(screen.getByTestId('tip-kicker')).toHaveTextContent('tip');
    expect(screen.getByTestId('tip-rule')).toBeTruthy();
    expect(screen.getByTestId('tip-non-standard')).toHaveProp(
      'accessibilityLabel',
      'Often said: How much is the time?',
    );
    expect(screen.getByTestId('tip-standard')).toHaveProp(
      'accessibilityLabel',
      'Better: What time is it?',
    );
    expect(screen.getByTestId('tip-explanation')).toHaveTextContent(
      'Time is asked by its hour, not by its amount.',
    );
    expect(screen.getByTestId('tip-example')).toHaveTextContent('Excuse me, what time is it?');
    expect(screen.getByTestId('tip-source')).toHaveTextContent(
      'Source: A style guide; A dictionary of usage',
    );
  });

  it('shows only the right way when the Tip has no non-standard form', async () => {
    await render(inEdition(<EntryCard card={withoutNonStandard} />));

    expect(screen.queryByTestId('tip-non-standard')).toBeNull();
    expect(screen.queryByText('Often said')).toBeNull();
    expect(screen.getByLabelText('Better: What time is it?')).toBeTruthy();
    expect(screen.getByTestId('tip-explanation')).toBeTruthy();
    expect(screen.queryByTestId('tip-example')).toBeNull();
    expect(screen.queryByTestId('tip-source')).toBeNull();
  });

  it('reads the title, then each form under its label, to VoiceOver', async () => {
    await render(inEdition(<EntryCard card={card} />));

    expect(screen.getByRole('header', { name: 'Tip: What time is it?' })).toBeTruthy();
    expect(screen.getByLabelText('Often said: How much is the time?')).toBeTruthy();
    expect(screen.getByLabelText('Better: What time is it?')).toBeTruthy();
  });

  it('sets the standard form as a phrase at the board size, not at the Lemma size', async () => {
    await render(inEdition(<EntryCard card={card} />));

    const form = within(screen.getByTestId('tip-standard')).getByText('What time is it?');
    // Board С2.6: «Українською краще» at 30 pt, where the Lemma at step M is 50.
    expect(form).toHaveStyle({ fontSize: 30 });
  });
});

describe('the Tip card with the Source tab (ADR 0116)', () => {
  it('moves the sources out of the rule tab into a last tab, so the bar reads Rule · Source', async () => {
    await render(inEdition(<EntryCard card={card} tabs sourceTab />));

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
    await render(inEdition(<EntryCard card={withExceptions} tabs sourceTab tipExceptions />));

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
    await render(inEdition(<EntryCard card={withExceptions} tabs sourceTab />));

    expect(screen.queryByTestId('tip-tab-exceptions')).toBeNull();
  });

  it('keeps one tab and no bar for a Tip without sources', async () => {
    await render(inEdition(<EntryCard card={withoutNonStandard} tabs sourceTab />));

    expect(screen.queryByRole('tablist')).toBeNull();
  });
});

describe('the Tip card in tabs (board e9)', () => {
  it('sets the title at the board size, 30 on 33', async () => {
    await render(inEdition(<EntryCard card={card} tabs />));

    expect(screen.getByTestId('tip-title')).toHaveStyle({ fontSize: 30, lineHeight: 33 });
  });

  it('keeps «Often said» over the rule tab: the explanation, a chip of the standard form and of the Example, and the sources', async () => {
    await render(inEdition(<EntryCard card={card} tabs />));

    expect(screen.getByLabelText('Often said: How much is the time?')).toBeTruthy();
    expect(screen.queryByRole('tablist')).toBeNull();
    expect(screen.getByTestId('tip-explanation')).toHaveStyle({ fontSize: 20, lineHeight: 28 });
    expect(screen.getByTestId('tip-word-0')).toHaveTextContent('What time is it?');
    expect(screen.getByTestId('tip-word-1')).toHaveTextContent('Excuse me, what time is it?');
    expect(screen.queryByTestId('tip-standard')).toBeNull();
    expect(screen.queryByTestId('tip-example')).toBeNull();
    expect(screen.getByTestId('tip-source')).toHaveTextContent(
      'Source: A style guide; A dictionary of usage',
    );
  });

  it('shows only the title and the non-standard form under Self-check, the rule empty until the reveal', async () => {
    await render(inEdition(<EntryCard card={card} tabs selfCheck />));

    expect(screen.getByLabelText('Often said: How much is the time?')).toBeTruthy();
    expect(screen.queryByTestId('tip-explanation')).toBeNull();
    expect(screen.queryByTestId('tip-word-0')).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Show' }));

    expect(screen.getByTestId('tip-explanation')).toBeTruthy();
  });
});

describe('Self-check on a Tip card', () => {
  it('shows only the title and the non-standard form, its marks inactive, until the reader reveals it', async () => {
    const onMark = jest.fn();
    await render(
      inEdition(
        <EntryCard
          card={card}
          selfCheck
          slots={{
            slot: 'actions',
            actions: (
              <ActionRow
                marks={<KnowledgeButtons entryKind="word" mark={undefined} onTap={onMark} />}
              />
            ),
          }}
        />,
      ),
    );

    expect(screen.getByRole('header', { name: 'Tip: What time is it?' })).toBeTruthy();
    expect(screen.getByLabelText('Often said: How much is the time?')).toBeTruthy();
    for (const concealed of ['tip-standard', 'tip-explanation', 'tip-example', 'tip-source']) {
      expect(screen.queryByTestId(concealed)).toBeNull();
    }
    await fireEvent.press(screen.getByRole('button', { name: 'Known', disabled: true }));
    expect(onMark).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole('button', { name: 'Show' }));

    expect(screen.getByLabelText('Better: What time is it?')).toBeTruthy();
    expect(screen.getByTestId('tip-explanation')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Show' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Known', disabled: false }));
    expect(onMark).toHaveBeenCalledWith('known');
  });

  it('shows only the title until the reveal when the Tip has no non-standard form', async () => {
    await render(inEdition(<EntryCard card={withoutNonStandard} selfCheck />));

    expect(screen.getByRole('header', { name: 'Tip: What time is it?' })).toBeTruthy();
    expect(screen.queryByTestId('tip-non-standard')).toBeNull();
    expect(screen.queryByTestId('tip-standard')).toBeNull();
    expect(screen.queryByTestId('tip-explanation')).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Show' }));

    expect(screen.getByLabelText('Better: What time is it?')).toBeTruthy();
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
    expect(screen.getByTestId('tip-standard')).toHaveTextContent(/What time is it\?/);
    expect(screen.getByTestId('tip-explanation')).toHaveTextContent('Time is asked by its hour.');
    expect(screen.getByTestId('tip-example')).toHaveTextContent(/Excuse me, what time is it\?/);
  });
});

describe('a long Tip title', () => {
  it('is drawn small enough for its widest word to fit a line, in three lines at most', async () => {
    const title = 'Interregional, intercontinental and international meetings';
    await render(inEdition(<EntryCard card={{ ...card, model: { ...model, title } }} />));
    const shown = screen.getByTestId('tip-title');
    const line = shown.parent;
    if (line === null) throw new Error('The title has no line around it');
    await fireEvent(line, 'layout', { nativeEvent: { layout: { width: 301 } } });
    // Every word measured on its own line at full size: the widest is twice the line.
    const measured = screen
      .getAllByText(title, { includeHiddenElements: true })
      .find((element) => element !== shown);
    if (measured === undefined) throw new Error('The title is not measured');
    await fireEvent(measured, 'textLayout', { nativeEvent: { lines: [{ width: 600 }] } });

    const fitted = screen.getByTestId('tip-title');
    expect(fitted).toHaveStyle({ fontSize: 30 / 2, lineHeight: 33 / 2 });
    expect(fitted.props).toMatchObject({ numberOfLines: 3, adjustsFontSizeToFit: true });
  });
});
