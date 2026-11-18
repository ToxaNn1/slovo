import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { systemSchedule } from '@slovo/ui';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import { open, renderScreen, resetGameScreen } from './test-support';

beforeEach(resetGameScreen);

/** The right vowel of every Round of «Наголос» in the test content. */
const RIGHT_VOWEL = 'о, третя літера';

/** Answers the Round of «Наголос» on screen with a wrong vowel. */
async function pressWrongVowel() {
  const wrong = screen
    .getAllByRole('button', { name: /^о, / })
    .find((vowel) => vowel.props['accessibilityLabel'] !== RIGHT_VOWEL);
  if (wrong === undefined) throw new Error('No wrong vowel');
  await fireEvent.press(wrong);
}

/** Moves the faked time on by `ms` milliseconds, as the banner's schedule reads it. */
async function advance(ms: number) {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });
}

/** The banner's title and its line, as the reader sees them. */
function banner() {
  const shown = screen.getByTestId('game-answer-banner');
  return {
    title: within(shown).getByRole('header'),
    line: within(shown).queryByTestId('game-answer-banner-line'),
  };
}

describe('the Game screen', () => {
  describe('the answer banner', () => {
    beforeEach(async () => {
      jest.useFakeTimers({ now: new Date('2026-10-26T09:00:00Z') });
      await open({
        clock: { now: () => new Date(), timeZone: () => 'Europe/Kyiv' },
        schedule: systemSchedule,
        switchedOn: ['gameAnswerBanner'],
      });
    });

    afterEach(() => {
      jest.restoreAllMocks();
      jest.useRealTimers();
    });

    it('praises each right answer in turn, with no sheet and no «Далі →», and brings the next Round with no tap', async () => {
      await renderScreen();
      await fireEvent.press(screen.getByTestId('game-mode-stress'));

      for (const [index, praise] of ['Влучив!', 'В яблучко!', 'Точно!', 'Влучив!'].entries()) {
        await fireEvent.press(screen.getByRole('button', { name: RIGHT_VOWEL }));

        const { title, line } = banner();
        expect(title).toHaveTextContent(praise);
        if (line !== null) expect(line).toHaveTextContent(/^\+\d+ XP$/);
        expect(screen.queryByTestId('game-sheet')).toBeNull();
        expect(screen.queryByRole('button', { name: 'Далі →' })).toBeNull();

        await advance(949);
        expect(screen.getByTestId('game-answer-banner')).toBeOnTheScreen();
        await advance(1);
        expect(screen.queryByTestId('game-answer-banner')).toBeNull();
        expect(screen.getByTestId('game-progress').props['accessibilityLabel']).toBe(
          `Пройдено раундів: ${String(index + 1)} з 15`,
        );
      }
    });

    it('names the right answer after a wrong one, says «Життя все» when it took the last Life, and the Game is lost when it moves on', async () => {
      await renderScreen();
      await fireEvent.press(screen.getByTestId('game-mode-stress'));

      // As many wrong answers as the Game has Lives, which its header counts.
      const lives = screen.getAllByTestId(/^game-life-\d+$/, { includeHiddenElements: true });
      expect(lives.length).toBeGreaterThan(1);
      for (let wrong = 1; wrong <= lives.length; wrong += 1) {
        await pressWrongVowel();

        const { title, line } = banner();
        expect(title).toHaveTextContent(wrong === lives.length ? 'Життя все' : 'Мимо');
        expect(line).toHaveTextContent(/^Майже\. Ось як правильно: \S+$/);
        expect(screen.queryByRole('button', { name: 'Далі →' })).toBeNull();

        await advance(1599);
        expect(screen.getByTestId('game-answer-banner')).toBeOnTheScreen();
        await advance(1);
        expect(screen.queryByTestId('game-answer-banner')).toBeNull();
      }
      await waitFor(() => {
        expect(screen.queryByTestId('game-round')).toBeNull();
      });
    });

    it('has VoiceOver read the banner, and holds the Round until it has finished', async () => {
      jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(true);
      const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibilityWithOptions');
      const finished: (() => void)[] = [];
      jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation((event, handler) => {
        if (event === 'announcementFinished') {
          finished.push(() => {
            const [read] = announce.mock.calls.at(-1) ?? [''];
            handler({ announcement: read, success: true });
          });
        }
        return { remove: () => undefined };
      });
      await renderScreen();
      await fireEvent.press(screen.getByTestId('game-mode-stress'));

      await fireEvent.press(screen.getByRole('button', { name: RIGHT_VOWEL }));
      await advance(0);

      expect(announce).toHaveBeenCalledWith(expect.stringMatching(/^Влучив!/), { queue: true });
      await advance(2000);
      expect(screen.getByTestId('game-answer-banner')).toBeOnTheScreen();
      await act(async () => {
        for (const done of finished) done();
        await Promise.resolve();
      });
      await waitFor(() => {
        expect(screen.queryByTestId('game-answer-banner')).toBeNull();
      });
      expect(screen.getByTestId('game-progress').props['accessibilityLabel']).toBe(
        'Пройдено раундів: 1 з 15',
      );
    });
  });

  describe('the answer card', () => {
    it('answers in the sheet over the Round with «Влучно!» or «Майже. Наступне вийде.» and the Definition, «Далі →» moving on, and keeps the Example for the Game Review', async () => {
      await open({ switchedOn: [] });
      await renderScreen();

      await fireEvent.press(screen.getByTestId('game-mode-stress'));
      await fireEvent.press(screen.getByRole('button', { name: 'о, третя літера' }));

      expect(screen.getAllByTestId('game-answer-card')).toHaveLength(1);
      const card = within(screen.getByTestId('game-sheet')).getByTestId('game-answer-card');
      expect(within(card).getByRole('header')).toHaveTextContent('Влучно!');
      expect(within(card).getByTestId('game-answer-card-line')).toHaveTextContent(
        /^The meaning of test\d+\.$/,
      );
      expect(card).not.toHaveTextContent(/Речення/);

      await fireEvent.press(within(card).getByRole('button', { name: 'Далі →' }));

      await waitFor(() => {
        expect(screen.queryByTestId('game-answer-card')).toBeNull();
      });
      expect(screen.getByTestId('game-progress').props['accessibilityLabel']).toBe(
        'Пройдено раундів: 1 з 15',
      );
      const wrong = screen
        .getAllByRole('button', { name: /^о, / })
        .find((vowel) => vowel.props['accessibilityLabel'] !== 'о, третя літера');
      if (wrong === undefined) throw new Error('No wrong vowel');
      await fireEvent.press(wrong);

      expect(within(screen.getByTestId('game-answer-card')).getByRole('header')).toHaveTextContent(
        'Майже. Наступне вийде.',
      );

      await fireEvent.press(screen.getByRole('button', { name: 'Далі →' }));
      for (let round = 3; round <= 15; round += 1) {
        await waitFor(() => {
          expect(screen.getByTestId('game-vowels')).toBeOnTheScreen();
        });
        await fireEvent.press(screen.getByRole('button', { name: 'о, третя літера' }));
        await fireEvent.press(screen.getByRole('button', { name: 'Далі →' }));
      }
      await waitFor(() => {
        expect(screen.getByTestId('game-review')).toBeOnTheScreen();
      });
      await fireEvent.press(screen.getByTestId('game-review-row-1'));

      expect(screen.getByTestId('game-review-details')).toHaveTextContent(/Речення \d+/);
    });
  });
});
