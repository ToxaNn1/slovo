import type { TipCardModel, TipFeedCard } from '@slovo/core';
import { ActionRow, EditionProvider, EntryCard, KnowledgeButtons } from '@slovo/ui';
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { testStrings } from '../test-strings';

const strings = testStrings({
  wordCard: {
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
  tipCard: { chip: 'tip', heading: 'Tip: {title}' },
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
  it('shows the title with its chip, both forms under the Correction card labels, the explanation, the example and the sources', async () => {
    await render(inEdition(<EntryCard card={card} />));

    expect(screen.getByTestId('tip-card')).toBeTruthy();
    expect(screen.getByTestId('tip-title')).toHaveTextContent('What time is it?');
    expect(screen.getByTestId('tip-chip')).toHaveTextContent('tip');
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
});

describe('Self-check on a Tip card', () => {
  it('shows only the title and the non-standard form, its marks inactive, until the reader reveals it', async () => {
    const onMark = jest.fn();
    await render(
      inEdition(
        <EntryCard
          card={card}
          selfCheck
          actions={
            <ActionRow
              marks={<KnowledgeButtons entryKind="word" mark={undefined} onTap={onMark} />}
            />
          }
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
