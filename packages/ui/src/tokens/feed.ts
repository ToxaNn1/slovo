/** The tokens of the Feed: its header and Feed Notices. */

/** The XP bar's side padding. */
export const xpBarPadding = 14;

/**
 * The Feed's header, from the design: the logo's wedge and its gap to the
 * name, the gap between today and the Streak pill, and how tall the fade at
 * its lower edge is, where a scrolled card passes under it.
 */
export const feedHeader = {
  logoWedge: { width: 15, height: 22 },
  logoGap: 8,
  endGap: 10,
  fade: 16,
} as const;

/**
 * The Streak pill in the Feed's header: its height and corner radius, its
 * padding (the left side carries the mark, so it is tighter), the gap after
 * the mark and the mark's box.
 */
export const streakPill = {
  height: 32,
  radius: 10,
  padding: { left: 8, right: 11 },
  gap: 5,
  mark: { width: 16, height: 18 },
} as const;

/**
 * The card of a Feed Notice, from the design: its corner radius, padding
 * and the gap between its parts; the notification mark's box, corner radius
 * and wedge; the gap between the Community Word's Word and its Definition;
 * and the Weekly Recap's grid of numbers, three to a row.
 */
export const noticeCard = {
  radius: 24,
  padding: 20,
  gap: 14,
  wordGap: 10,
  mark: { box: 40, radius: 11, wedge: { width: 12, height: 18 } },
  recap: { columns: 3, gap: 8, padding: { vertical: 12, horizontal: 10 }, lineGap: 6 },
} as const;

/**
 * The end-of-Cycle card, from the design: the ∞ behind it (its size and how
 * far it reaches past the left edge and below the top), the gap between its
 * parts and the chevrons' box.
 */
export const endOfCycleCard = {
  infinity: { size: 330, left: -40, top: 30 },
  gap: 18,
  chevrons: { width: 22, height: 30 },
} as const;
