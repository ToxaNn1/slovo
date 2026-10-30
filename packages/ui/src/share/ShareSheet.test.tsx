import type { EditionStrings } from '@slovo/contracts';
import {
  buildShareCardContent,
  type AnyEntryCard,
  type EntryFeedCard,
  type IdiomCardModel,
  type IdiomFeedCard,
  type SynonymRowCardModel,
  type SynonymRowFeedCard,
  type TipCardModel,
  type TipFeedCard,
  type WeeklyRecapModel,
} from '@slovo/core';
import { EditionProvider, ShareSheet, type ShareSheetOutcome } from '@slovo/ui';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

const strings = {
  wordCard: { stress: 'stress on {vowels}', stressOr: 'or' },
  share: {
    title: 'Share the card',
    format: 'Format',
    story: 'Story',
    square: 'Square',
    share: 'Share',
    captureFailed: 'Could not make the image.',
    nonStandard: 'Often said',
    standard: 'Better',
    weeklyRecap: {
      title: 'My week in SLOVO',
      week: '{from}–{to} {month}',
      months: ['', '', '', '', '', '', '', '', '', 'October'],
      seen: 'seen',
      saved: 'saved',
      known: 'known',
      streak: 'streak',
    },
  },
  correctionCard: { correctionTypes: { calque: 'calque' } },
  idiomCard: { idiomTypes: { idiom: 'idiom', placeName: 'place name' }, etymology: 'Origin' },
  synonymRowCard: { chip: 'synonyms', heading: '{dominant}, synonym row: {members}' },
  tipCard: { chip: 'tip', heading: 'Tip: {title}' },
} as unknown as EditionStrings;

const card: EntryFeedCard = {
  kind: 'correction',
  entryId: 'c1',
  model: {
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
    explanation: 'Why join in is better.',
    examplePair: { nonStandard: 'I take part.', standard: 'I join in.' },
    sourceNames: [],
    literaryUses: [],
  },
};

/** How long the toast stays, from the design. */
const TOAST_MS = 4000;

async function renderSheet(outcome: ShareSheetOutcome, shown: AnyEntryCard = card) {
  const onClose = jest.fn();
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <EditionProvider edition={{ locale: 'en' }} strings={strings}>
        <ShareSheet
          visible
          content={buildShareCardContent({ card: shown, todaysWordOfTheDay: false }, strings)}
          watermark="SLOVO"
          initialFormat="story"
          onFormatChange={jest.fn()}
          onShare={() => Promise.resolve(outcome)}
          onClose={onClose}
        />
      </EditionProvider>
    </SafeAreaProvider>,
  );
  return { onClose };
}

describe('ShareSheet', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('says so for 4 s when sharing fails, and stays open', async () => {
    const { onClose } = await renderSheet('failed');

    await fireEvent.press(screen.getByRole('button', { name: 'Share' }));

    expect(screen.getByText('Could not make the image.')).toBeOnTheScreen();
    expect(onClose).not.toHaveBeenCalled();
    await act(async () => {
      await jest.advanceTimersByTimeAsync(TOAST_MS);
    });
    expect(screen.queryByText('Could not make the image.')).not.toBeOnTheScreen();
  });

  it('closes once the system share sheet closes', async () => {
    const { onClose } = await renderSheet('closed');

    await fireEvent.press(screen.getByRole('button', { name: 'Share' }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Could not make the image.')).not.toBeOnTheScreen();
  });
});

function idiomCard(overrides: Partial<IdiomCardModel> = {}): IdiomFeedCard {
  const model: IdiomCardModel = {
    kind: 'idiom',
    idiomId: 'i1',
    expression: 'to beat the bushes',
    idiomType: 'idiom',
    primaryDefinition: 'To idle about.',
    extraDefinitions: ['To waste time.'],
    examples: [{ text: 'He beat the bushes all day.' }],
    etymology: 'From the hunt.',
    sourceNames: ['A phrase dictionary'],
    ...overrides,
  };
  return { kind: 'idiom', entryId: model.idiomId, model };
}

/** The Share Card in the preview; the one drawn off screen for the image is the same. */
function previewCard() {
  return within(screen.getByTestId('share-preview')).getByTestId('share-card');
}

describe('The Share Card of an Idiom', () => {
  it("shows an idiom's chip, its expression and its primary Definition", async () => {
    await renderSheet('closed', idiomCard());

    const shown = previewCard();
    expect(within(shown).getByText('idiom')).toBeOnTheScreen();
    expect(within(shown).getByText('to beat the bushes')).toBeOnTheScreen();
    expect(within(shown).getByText('To idle about.')).toBeOnTheScreen();
    expect(within(shown).queryByText('To waste time.')).not.toBeOnTheScreen();
    expect(within(shown).queryByText('From the hunt.')).not.toBeOnTheScreen();
    expect(within(shown).queryByText('He beat the bushes all day.')).not.toBeOnTheScreen();
    expect(shown).toHaveAccessibleName('idiom. to beat the bushes. To idle about.');
  });

  it("adds a place name's etymology under «Origin»", async () => {
    await renderSheet(
      'closed',
      idiomCard({
        idiomId: 'i2',
        expression: 'Kyiv',
        idiomType: 'placeName',
        primaryDefinition: 'The capital on the Dnipro.',
        etymology: 'Named after Kyi',
      }),
    );

    const shown = previewCard();
    expect(within(shown).getByText('place name')).toBeOnTheScreen();
    expect(within(shown).getByText('Kyiv')).toBeOnTheScreen();
    expect(within(shown).getByText('The capital on the Dnipro.')).toBeOnTheScreen();
    expect(within(shown).getByText('Origin')).toBeOnTheScreen();
    expect(within(shown).getByText('Named after Kyi')).toBeOnTheScreen();
    expect(shown).toHaveAccessibleName(
      'place name. Kyiv. The capital on the Dnipro. Origin: Named after Kyi',
    );
  });
});

function synonymRowCard(members: readonly string[]): SynonymRowFeedCard {
  const model: SynonymRowCardModel = {
    kind: 'synonymRow',
    synonymRowId: 'r1',
    dominant: { text: 'wa\u0301lk', stressedVowels: ['a'], wordId: undefined },
    meaning: 'To move on foot.',
    members: members.map((text) => ({
      text,
      stressedVowels: [],
      wordId: undefined,
      shadeNote: 'a shade',
    })),
    example: { text: 'They walked to the river.' },
    sourceNames: ['A synonym dictionary'],
  };
  return { kind: 'synonymRow', entryId: model.synonymRowId, model };
}

describe('The Share Card of a Synonym Row', () => {
  it('shows its chip, the dominant, the meaning and the members', async () => {
    await renderSheet('closed', synonymRowCard(['stro\u0301ll', 'limp', 'tramp']));

    const shown = previewCard();
    expect(within(shown).getByText('synonyms')).toBeOnTheScreen();
    expect(within(shown).getByText('wa\u0301lk')).toBeOnTheScreen();
    expect(within(shown).getByText('To move on foot.')).toBeOnTheScreen();
    expect(within(shown).getByText('stro\u0301ll, limp, tramp')).toBeOnTheScreen();
    expect(within(shown).queryByText('a shade')).not.toBeOnTheScreen();
    expect(within(shown).queryByText('They walked to the river.')).not.toBeOnTheScreen();
    expect(shown).toHaveAccessibleName('walk, synonym row: stroll, limp, tramp. To move on foot.');
  });

  it('ends a long row in «…» after its first 6 members', async () => {
    await renderSheet(
      'closed',
      synonymRowCard(['stroll', 'limp', 'tramp', 'pace', 'trudge', 'march', 'hike']),
    );

    const shown = previewCard();
    expect(within(shown).getByText('stroll, limp, tramp, pace, trudge, march…')).toBeOnTheScreen();
    expect(within(shown).queryByText(/hike/)).not.toBeOnTheScreen();
    expect(shown).toHaveAccessibleName(
      'walk, synonym row: stroll, limp, tramp, pace, trudge, march… To move on foot.',
    );
  });
});

function tipCard(overrides: Partial<TipCardModel> = {}): TipFeedCard {
  const model: TipCardModel = {
    kind: 'tip',
    tipId: 't1',
    title: 'Asking the time',
    nonStandardForm: 'How much time?',
    standardForm: 'What time is it?',
    explanation: 'Why the hour is asked so.',
    example: { text: 'What time is it, please?' },
    sourceNames: ['A style guide'],
    ...overrides,
  };
  return { kind: 'tip', entryId: model.tipId, model };
}

describe('The Share Card of a Tip', () => {
  it('shows its chip, the title, the non-standard form and the standard form', async () => {
    await renderSheet('closed', tipCard());

    const shown = previewCard();
    expect(within(shown).getByText('tip')).toBeOnTheScreen();
    expect(within(shown).getByText('Asking the time')).toBeOnTheScreen();
    expect(within(shown).getByText('Often said')).toBeOnTheScreen();
    expect(within(shown).getByText('How much time?')).toBeOnTheScreen();
    expect(within(shown).getByText('Better')).toBeOnTheScreen();
    expect(within(shown).getByText('What time is it?')).toBeOnTheScreen();
    expect(within(shown).queryByText('Why the hour is asked so.')).not.toBeOnTheScreen();
    expect(within(shown).queryByText('What time is it, please?')).not.toBeOnTheScreen();
    expect(shown).toHaveAccessibleName(
      'Tip: Asking the time. Often said: How much time? Better: What time is it?',
    );
  });

  it('shows only the standard form of a Tip with no non-standard form', async () => {
    await renderSheet(
      'closed',
      tipCard({
        tipId: 't2',
        title: 'Greeting',
        nonStandardForm: undefined,
        standardForm: 'Good day!',
      }),
    );

    const shown = previewCard();
    expect(within(shown).getByText('Greeting')).toBeOnTheScreen();
    expect(within(shown).queryByText('Often said')).not.toBeOnTheScreen();
    expect(within(shown).getByText('Better')).toBeOnTheScreen();
    expect(within(shown).getByText('Good day!')).toBeOnTheScreen();
    expect(shown).toHaveAccessibleName('Tip: Greeting. Better: Good day!');
  });
});

/** The week of Monday 20 to Sunday 26 October 2025. */
const recap: WeeklyRecapModel = {
  firstDay: { year: 2025, month: 10, day: 20 },
  lastDay: { year: 2025, month: 10, day: 26 },
  seen: 34,
  saved: 5,
  known: 0,
  streak: 9,
};

async function renderRecapSheet(format: 'story' | 'square') {
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <EditionProvider edition={{ locale: 'en' }} strings={strings}>
        <ShareSheet
          visible
          content={buildShareCardContent({ recap, hideStreak: false }, strings)}
          watermark="SLOVO"
          initialFormat={format}
          onFormatChange={jest.fn()}
          onShare={() => Promise.resolve('closed')}
          onClose={jest.fn()}
        />
      </EditionProvider>
    </SafeAreaProvider>,
  );
}

describe('The Share Card of a Weekly Recap', () => {
  it.each(['story', 'square'] as const)(
    'shows the title, the dates and each number with its label in a %s',
    async (format) => {
      await renderRecapSheet(format);

      const shown = previewCard();
      expect(within(shown).getByText('My week in SLOVO')).toBeOnTheScreen();
      expect(within(shown).getByText('20–26 October')).toBeOnTheScreen();
      for (const [count, label] of [
        ['34', 'seen'],
        ['5', 'saved'],
        ['0', 'known'],
        ['9', 'streak'],
      ] as const) {
        expect(within(shown).getByText(count)).toBeOnTheScreen();
        expect(within(shown).getByText(label)).toBeOnTheScreen();
      }
      expect(within(shown).getByText('SLOVO')).toBeOnTheScreen();
    },
  );

  it('reads the dates, the title and the numbers to VoiceOver', async () => {
    await renderRecapSheet('story');

    expect(previewCard()).toHaveAccessibleName(
      '20–26 October. My week in SLOVO. 34 seen. 5 saved. 0 known. 9 streak',
    );
  });
});
