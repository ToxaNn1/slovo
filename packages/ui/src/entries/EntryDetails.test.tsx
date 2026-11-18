import type { AnyEntryCard } from '@slovo/core';
import { EditionProvider, EntryDetails } from '@slovo/ui';
import { describe, expect, it, jest } from '@jest/globals';
import { render, screen, within } from '@testing-library/react-native';

import { testStrings } from '../test-strings';

const strings = testStrings({
  wordCard: { tabSource: 'Source', example: '{text}', exampleAuthor: '— {author}' },
  idiomCard: {
    idiomTypes: { idiom: 'idiom', placeName: 'place name', proverb: 'proverb' },
    heading: '{expression}, {type}',
    etymology: 'Origin',
    source: 'Source: {source}',
    tabs: { essence: 'Essence', origin: 'Origin', example: 'Example' },
  },
  correctionCard: { nonStandard: 'Often said', standard: 'Better', source: 'Source: {source}' },
  tipCard: {
    chip: 'tip',
    heading: 'Tip: {title}',
    tabs: { rule: 'Rule', exceptions: 'Exceptions' },
  },
});

const idiom: AnyEntryCard = {
  kind: 'idiom',
  entryId: 'i_bushes',
  model: {
    kind: 'idiom',
    idiomId: 'i_bushes',
    expression: 'to beat the bushes',
    idiomType: 'idiom',
    primaryDefinition: 'To idle about.',
    extraDefinitions: [],
    examples: [{ text: 'He beat the bushes all day.' }],
    etymology: 'From the hunt.',
    sourceNames: [],
  },
};

const tip: AnyEntryCard = {
  kind: 'tip',
  entryId: 't_time',
  model: {
    kind: 'tip',
    tipId: 't_time',
    title: 'What time is it?',
    nonStandardForm: undefined,
    standardForm: 'What time is it?',
    explanation: 'Time is asked by its hour, not by its amount.',
    example: undefined,
    exceptions: undefined,
    sourceNames: [],
  },
};

async function renderDetails(card: AnyEntryCard, panelAllKinds = true) {
  await render(
    <EditionProvider edition={{ locale: 'en' }} strings={strings}>
      <EntryDetails
        card={card}
        back="Back"
        onBack={jest.fn()}
        topInset={0}
        bottomInset={0}
        panelAllKinds={panelAllKinds}
      />
    </EditionProvider>,
  );
}

describe('Entry details of a kind other than a Word (owner 15.11)', () => {
  it.each([
    [
      'an Idiom',
      idiom,
      'To beat the bushes',
      'Idiom',
      'to beat the bushes, idiom',
      'To idle about.',
    ],
    [
      'a Tip',
      tip,
      'What time is it?',
      'Tip',
      'Tip: What time is it?',
      'Time is asked by its hour, not by its amount.',
    ],
  ])(
    'heads %s in the red panel with its kind under it, and its meaning on the ground with no card frame',
    async (_, card, title, kind, heading, meaning) => {
      await renderDetails(card);

      const panel = screen.getByTestId('entry-panel');
      expect(within(panel).getByTestId('entry-panel-title')).toHaveTextContent(title);
      expect(within(panel).getByRole('header', { name: heading })).toBeOnTheScreen();
      expect(
        within(panel).getByTestId('entry-panel-kind', { includeHiddenElements: true }),
      ).toHaveTextContent(kind);
      expect(screen.queryByTestId(`${card.kind}-card`)).not.toBeOnTheScreen();
      expect(screen.queryByTestId(`${card.kind}-kicker-row`)).not.toBeOnTheScreen();
      const body = screen.getByTestId('entry-body');
      expect(within(body).getByText(meaning)).toBeOnTheScreen();
    },
  );

  it('keeps the card of another kind under a bare panel with `entryPanelAllKinds` off', async () => {
    await renderDetails(idiom, false);

    expect(screen.getByTestId('idiom-card')).toBeOnTheScreen();
    expect(screen.queryByTestId('entry-panel-headline')).not.toBeOnTheScreen();
  });
});
