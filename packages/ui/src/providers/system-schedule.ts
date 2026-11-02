import type { Schedule } from '@slovo/core';

/** The real clock a Core module runs something later by, such as a haptic or a new try to plan the Game's offers. */
export const systemSchedule: Schedule = (run, delay) => {
  const timer = setTimeout(run, delay);
  return () => {
    clearTimeout(timer);
  };
};
