/**
 * The ISO week (UTC) of a time, by its Monday as `YYYY-MM-DD`: the week of
 * Sunday 23:59 UTC is the one that started six days before, whatever the
 * reader's time zone (ADR 0060).
 */
export function isoWeekOf(time: Date): string {
  const monday = new Date(time.getTime());
  // getUTCDay() counts Sunday as 0; the ISO week starts on Monday.
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
  return monday.toISOString().slice(0, 10);
}
