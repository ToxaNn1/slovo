/**
 * How far the reader is with today's Daily Crossword, for its card: nothing
 * entered («Почати»), something entered («Продовжити»), or solved.
 */
export type DailyCrosswordProgress = 'untouched' | 'started' | 'solved';
