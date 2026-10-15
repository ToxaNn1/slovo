import { describe, expect, it } from 'vitest';

import { createGameHaptics, createHaptics, type HapticEngine, type Schedule } from './index';

/** A clock the test moves by hand: what is scheduled runs once the time reaches it. */
function clock() {
  let now = 0;
  const pending: { at: number; run: () => void }[] = [];
  const schedule: Schedule = (run, delay) => {
    const entry = { at: now + delay, run };
    pending.push(entry);
    return () => {
      const place = pending.indexOf(entry);
      if (place >= 0) pending.splice(place, 1);
    };
  };
  return {
    schedule,
    advance(ms: number) {
      now += ms;
      for (const entry of pending.filter((due) => due.at <= now).sort((a, b) => a.at - b.at)) {
        pending.splice(pending.indexOf(entry), 1);
        entry.run();
      }
    },
  };
}

/** The device's engine as a log of what it played and when. */
function setup({ vibration = () => true }: { vibration?: () => boolean } = {}) {
  const time = clock();
  const played: string[] = [];
  const engine: HapticEngine = {
    selection: () => played.push('selection'),
    impactLight: () => played.push('impactLight'),
    impactMedium: () => played.push('impactMedium'),
    success: () => played.push('success'),
    warning: () => played.push('warning'),
  };
  const feedback = createGameHaptics({
    haptics: createHaptics({ engine, vibration }),
    schedule: time.schedule,
  });
  return {
    feedback,
    played,
    advance: (ms: number) => {
      time.advance(ms);
    },
  };
}

describe('game haptics', () => {
  it('plays success at once for a right answer, and nothing after', () => {
    const { feedback, played, advance } = setup();

    feedback.rightAnswer();
    expect(played).toEqual(['success']);

    advance(5000);
    expect(played).toEqual(['success']);
  });

  it('plays warning at once for a wrong answer, then the lost Life 200 ms later', () => {
    const { feedback, played, advance } = setup();

    feedback.wrongAnswer();
    expect(played).toEqual(['warning']);

    advance(199);
    expect(played).toEqual(['warning']);
    advance(1);
    expect(played).toEqual(['warning', 'impactMedium']);

    advance(5000);
    expect(played).toEqual(['warning', 'impactMedium']);
  });

  it('plays success at once for a win, then again 300 ms later', () => {
    const { feedback, played, advance } = setup();

    feedback.win();
    expect(played).toEqual(['success']);

    advance(299);
    expect(played).toEqual(['success']);
    advance(1);
    expect(played).toEqual(['success', 'success']);

    advance(5000);
    expect(played).toEqual(['success', 'success']);
  });

  it('drops the haptics still to come once stopped', () => {
    const { feedback, played, advance } = setup();

    feedback.wrongAnswer();
    feedback.win();
    feedback.stop();
    advance(5000);

    expect(played).toEqual(['warning', 'success']);
  });

  it('plays nothing while Vibration is off', () => {
    const { feedback, played, advance } = setup({ vibration: () => false });

    feedback.rightAnswer();
    feedback.wrongAnswer();
    feedback.win();
    advance(5000);

    expect(played).toEqual([]);
  });

  it('asks Vibration when a delayed haptic comes, not when it was scheduled', () => {
    let vibration = true;
    const { feedback, played, advance } = setup({ vibration: () => vibration });

    feedback.wrongAnswer();
    vibration = false;
    advance(200);

    expect(played).toEqual(['warning']);
  });
});
