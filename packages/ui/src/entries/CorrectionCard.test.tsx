import { type CorrectionCardModel, type EntryFeedCard } from '@slovo/core';
import { EditionProvider, EntryCard } from '@slovo/ui';
import { describe, expect, it } from '@jest/globals';
import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { testStrings } from '../test-strings';
import { correctionStrike, typeRoles } from '../tokens';

const strings = testStrings({
  correctionCard: {
    title: 'Correction',
    correctionTypes: { calque: 'calque' },
    correctionType: 'Type: {type}',
    tabs: { better: 'Better', why: 'Why', examples: 'Examples' },
    nonStandard: 'People say',
    standard: 'Better say',
    otherEquivalents: 'also: {equivalents}',
    exampleNonStandard: 'People say: {text}',
    exampleStandard: 'Better: {text}',
    source: 'Source: {source}',
    literaryUses: 'How writers use it',
    literaryUseSource: '{author}, «{work}»',
    literaryUseSourceWithYear: '{author}, «{work}», {year}',
  },
  wordCard: { category: 'Category: {category}', stress: 'stress on {vowels}', stressOr: 'or' },
});

const model: CorrectionCardModel = {
  kind: 'correction',
  correctionId: 'c1',
  nonStandardForm: 'take part',
  nonStandardStressedVowels: [],
  mainEquivalent: 'join in',
  mainEquivalentStressedVowels: [],
  otherEquivalents: [],
  correctionType: 'calque',
  categoryId: 'everyday',
  categoryName: 'Everyday speech',
  explanation: 'Part is not taken; one joins in.',
  examplePair: {
    nonStandard: 'We take part in the race.',
    standard: 'We join in the race.',
    standardSegments: [
      { kind: 'text', text: 'We ' },
      { kind: 'standardForm', text: 'join in' },
      { kind: 'text', text: ' the race.' },
    ],
  },
  sourceNames: ['A dictionary'],
  literaryUses: [],
};

const card: EntryFeedCard = { kind: 'correction', entryId: 'c1', model };

async function renderCard() {
  await render(
    <EditionProvider edition={{ locale: 'en' }} strings={strings}>
      <EntryCard card={card} tabs />
    </EditionProvider>,
  );
}

const styleOf = (element: { props: Record<string, unknown> }) =>
  StyleSheet.flatten(element.props['style'] as never) as Record<string, unknown>;
const textStyle = (text: string) => styleOf(screen.getByText(text, { exact: true }));
const role = (name: keyof typeof typeRoles) => ({
  fontSize: typeRoles[name].size,
  fontWeight: typeRoles[name].weight,
  lineHeight: typeRoles[name].lineHeight,
});

describe('a Correction card (board XEntry2 e6)', () => {
  it('opens with the red kicker and its wedge, as the other cards do', async () => {
    await renderCard();

    expect(screen.getByTestId('correction-kicker')).toHaveProp('accessibilityLabel', 'Correction');
    expect(screen.getByTestId('correction-kicker-wedge')).toBeTruthy();
    expect(textStyle('Correction')).toMatchObject(role('cardKicker'));
  });

  it('names the Correction Type in the line over the struck form, in the muted label role', async () => {
    await renderCard();

    const form = screen.getByTestId('correction-non-standard');
    expect(form).toHaveProp('accessibilityLabel', 'People say, calque: take part');
    expect(within(form).getByTestId('correction-type')).toHaveTextContent('calque');
    expect(screen.getByText(/^People say/)).toHaveTextContent('People say · calque');
    expect(styleOf(screen.getByText(/^People say/))).toMatchObject(role('correctionFormLabel'));
  });

  it('strikes the non-standard form with a red bar tilted over its middle, not a text line', async () => {
    await renderCard();

    expect(textStyle('Take part')).toMatchObject(role('correctionStruck'));
    expect(textStyle('Take part')).not.toHaveProperty('textDecorationLine');
    expect(styleOf(screen.getByTestId('correction-non-standard-strike'))).toMatchObject({
      position: 'absolute',
      top: '50%',
      left: -correctionStrike.overhang,
      right: -correctionStrike.overhang,
      height: correctionStrike.thickness,
      transform: [{ rotate: correctionStrike.angle }],
    });
    expect(correctionStrike).toEqual({ thickness: 5, overhang: 4, angle: '-4deg' });
  });

  it('shows the standard form under its red label in the better tab, with the Category chip', async () => {
    await renderCard();

    expect(textStyle('Better say')).toMatchObject(role('correctionFormLabel'));
    expect(screen.getByTestId('correction-standard')).toHaveProp(
      'accessibilityLabel',
      'Better say: join in',
    );
    expect(textStyle('Join in')).toMatchObject({ fontWeight: '900' });
    expect(screen.getByTestId('correction-category')).toBeTruthy();
  });

  it('sets the explanation in the why tab in its own reading role, with the source line', async () => {
    await renderCard();
    await fireEvent.press(screen.getByTestId('correction-tab-why'));

    expect(textStyle('Part is not taken; one joins in.')).toMatchObject(role('correctionWhy'));
    expect(screen.getByTestId('correction-source')).toHaveTextContent('Source: A dictionary');
  });

  it('writes the examples tab as plain lines, the wrong one struck and the marked standard form of the right one bold', async () => {
    await renderCard();
    await fireEvent.press(screen.getByTestId('correction-tab-examples'));

    const pair = screen.getByTestId('correction-example-pair');
    expect(styleOf(pair)).not.toHaveProperty('backgroundColor');
    // The size follows the user's font size; the role gives the weight.
    expect(textStyle('We take part in the race.')).toMatchObject({
      fontWeight: typeRoles.correctionExample.weight,
      textDecorationLine: 'line-through',
    });
    expect(screen.getByTestId('correction-example-standard')).toHaveTextContent(
      'We join in the race.',
    );
    // The content marks «join in» as the standard form (ADR 0117), though
    // both sentences share «in»: the mark, not a comparison, picks the bold.
    expect(textStyle('join in')).toMatchObject({
      fontWeight: typeRoles.correctionExampleStrong.weight,
    });
    expect(screen.queryByText('join', { exact: true })).toBeNull();
    expect(screen.getByLabelText('Better: We join in the race.')).toBeTruthy();
  });

  it('starts every text it shows with a capital, whatever case the content has (owner decision 11)', async () => {
    const lowercase: EntryFeedCard = {
      kind: 'correction',
      entryId: 'c1',
      model: {
        ...model,
        explanation: 'part is not taken; one joins in.',
        examplePair: {
          nonStandard: 'we take part in the race.',
          standard: 'we join in the race.',
          standardSegments: [
            { kind: 'text', text: 'we ' },
            { kind: 'standardForm', text: 'join in' },
            { kind: 'text', text: ' the race.' },
          ],
        },
      },
    };
    await render(
      <EditionProvider edition={{ locale: 'en' }} strings={strings}>
        <EntryCard card={lowercase} tabs />
      </EditionProvider>,
    );

    expect(screen.getByTestId('correction-non-standard')).toHaveTextContent(/Take part/);
    expect(screen.getByTestId('correction-standard')).toHaveTextContent(/Join in/);
    expect(screen.getByTestId('correction-category')).toHaveTextContent('Everyday speech');
    await fireEvent.press(screen.getByTestId('correction-tab-why'));
    expect(screen.getByTestId('correction-explanation')).toHaveTextContent(
      'Part is not taken; one joins in.',
    );
    await fireEvent.press(screen.getByTestId('correction-tab-examples'));
    expect(screen.getByText('We take part in the race.', { exact: true })).toBeTruthy();
    expect(screen.getByTestId('correction-example-standard')).toHaveTextContent(
      'We join in the race.',
    );
  });

  // Owner shot 13.11: «міжрегіональному» broke inside the word, the title at full size.
  it('draws a long struck form small enough for its widest word to fit a line, in three lines at most', async () => {
    const long: EntryFeedCard = {
      kind: 'correction',
      entryId: 'c1',
      model: { ...model, nonStandardForm: 'take part in an interregional meeting' },
    };
    await render(
      <EditionProvider edition={{ locale: 'en' }} strings={strings}>
        <EntryCard card={long} tabs />
      </EditionProvider>,
    );
    const text = 'Take part in an interregional meeting';
    const shown = screen.getByText(text, { exact: true });
    const line = shown.parent;
    if (line === null) throw new Error('The struck form has no line around it');
    await fireEvent(line, 'layout', { nativeEvent: { layout: { width: 301 } } });
    // Every word measured on its own line at full size: the widest is twice the line.
    const measured = screen
      .getAllByText(text, { includeHiddenElements: true })
      .find((element) => element !== shown);
    if (measured === undefined) throw new Error('The struck form is not measured');
    await fireEvent(measured, 'textLayout', { nativeEvent: { lines: [{ width: 600 }] } });

    const fitted = screen.getByText(text, { exact: true });
    expect(fitted).toHaveStyle({ fontSize: typeRoles.correctionStruck.size / 2 });
    expect(fitted).not.toHaveStyle({ opacity: 0 });
    expect(fitted.props).toMatchObject({ numberOfLines: 3, adjustsFontSizeToFit: true });
  });
});
