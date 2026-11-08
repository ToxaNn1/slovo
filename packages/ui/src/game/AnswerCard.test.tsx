import { AnswerCard, EditionProvider } from '@slovo/ui';
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import { testStrings } from '../test-strings';

const strings = testStrings({
  game: { round: { answerCard: { right: 'Spot on!', wrong: 'Close. Next one.', next: 'Next →' } } },
});

async function renderCard(right: boolean, line: string | undefined, onNext = jest.fn()) {
  await render(
    <EditionProvider edition={{ locale: 'en' }} strings={strings}>
      <AnswerCard right={right} line={line} onNext={onNext} />
    </EditionProvider>,
  );
  return onNext;
}

describe('AnswerCard', () => {
  it('heads a right answer with its verdict and the explanation line under it', async () => {
    await renderCard(true, 'open and honest');

    expect(screen.getByRole('header')).toHaveTextContent('Spot on!');
    expect(screen.getByTestId('game-answer-card-line')).toHaveTextContent('open and honest');
  });

  it('tells VoiceOver the verdict and the line as the card shows', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    await renderCard(false, 'open and honest');
    expect(announce).toHaveBeenCalledWith('Close. Next one. open and honest');
    announce.mockRestore();
  });

  it('heads a wrong answer with its own verdict', async () => {
    await renderCard(false, 'open and honest');

    expect(screen.getByRole('header')).toHaveTextContent('Close. Next one.');
  });

  it('shows no line when there is nothing to explain', async () => {
    await renderCard(true, undefined);

    expect(screen.queryByTestId('game-answer-card-line')).toBeNull();
  });

  it('moves on with «Next →»', async () => {
    const onNext = await renderCard(false, 'open and honest');

    await fireEvent.press(screen.getByRole('button', { name: 'Next →' }));

    expect(onNext).toHaveBeenCalledTimes(1);
  });
});
