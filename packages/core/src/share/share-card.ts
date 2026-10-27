import { fill, type EditionStrings } from '@slovo/contracts';

import type { LocalDate } from '../local-date';
import type { WeeklyRecapModel } from '../progress/weekly-recap';
import type { SynonymRowCardModel } from '../entries/synonym-row-card';
import type { TipCardModel } from '../entries/tip-card';

/** How many members of a Synonym Row its Share Card shows. */
const SHARED_MEMBERS = 6;

/**
 * What the Share Card of a Synonym Row shows, decided by the Core (ADR 0051):
 * the dominant, the meaning and the first 6 members, each with its Stress. The
 * UI ends the members with «…» when the row has more.
 */
export interface SynonymRowShareCardModel {
  readonly kind: 'synonymRow';
  readonly synonymRowId: string;
  readonly dominant: string;
  readonly meaning: string;
  /** The first 6 members, in the row's order. */
  readonly members: readonly string[];
  /** Whether the row has members beyond those shown. */
  readonly moreMembers: boolean;
}

/**
 * What the Share Card of a Tip shows, decided by the Core (ADR 0051): the
 * title, the non-standard form when the Tip has one, and the standard form.
 */
export interface TipShareCardModel {
  readonly kind: 'tip';
  readonly tipId: string;
  readonly title: string;
  readonly nonStandardForm: string | undefined;
  readonly standardForm: string;
}

/** The Share Card of a Synonym Row, from its card. */
export function buildSynonymRowShareCard(card: SynonymRowCardModel): SynonymRowShareCardModel {
  return {
    kind: 'synonymRow',
    synonymRowId: card.synonymRowId,
    dominant: card.dominant.text,
    meaning: card.meaning,
    members: card.members.slice(0, SHARED_MEMBERS).map(({ text }) => text),
    moreMembers: card.members.length > SHARED_MEMBERS,
  };
}

/** The Share Card of a Tip, from its card. */
export function buildTipShareCard(card: TipCardModel): TipShareCardModel {
  return {
    kind: 'tip',
    tipId: card.tipId,
    title: card.title,
    nonStandardForm: card.nonStandardForm,
    standardForm: card.standardForm,
  };
}

/**
 * What the Share Card of a Weekly Recap shows, decided by the Core (ADR 0054):
 * the title, the week's dates and the recap's numbers, with no words.
 */
export interface WeeklyRecapShareCardModel {
  readonly kind: 'weeklyRecap';
  /** «Мій тиждень у SLOVO». */
  readonly title: string;
  /** The week's dates, e.g. «20–26 жовтня». */
  readonly week: string;
  /** Seen, saved, Known (when the recap has it) and the Streak, in this order. */
  readonly numbers: readonly { readonly label: string; readonly count: number }[];
}

/** The Share Card of a Weekly Recap, in the Edition's texts. */
export function buildWeeklyRecapShareCard(
  recap: WeeklyRecapModel,
  strings: EditionStrings['share']['weeklyRecap'],
): WeeklyRecapShareCardModel {
  const { firstDay, lastDay, seen, saved, known, streak } = recap;
  const monthOf = ({ month }: LocalDate) => strings.months[month - 1] ?? '';
  const week =
    firstDay.month === lastDay.month
      ? fill(strings.week, {
          from: String(firstDay.day),
          to: String(lastDay.day),
          month: monthOf(lastDay),
        })
      : fill(strings.weekAcrossMonths, {
          from: String(firstDay.day),
          fromMonth: monthOf(firstDay),
          to: String(lastDay.day),
          toMonth: monthOf(lastDay),
        });
  return {
    kind: 'weeklyRecap',
    title: strings.title,
    week,
    numbers: [
      { label: strings.seen, count: seen },
      { label: strings.saved, count: saved },
      ...(known === undefined ? [] : [{ label: strings.known, count: known }]),
      { label: strings.streak, count: streak },
    ],
  };
}
