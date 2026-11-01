import { CROSSWORD_SIZE, fill, pluralCount, type EditionStrings } from '@slovo/contracts';

import type { AnyEntryCard } from '../feed/entry-feed-card';
import type { DailyCrosswordState } from '../game/daily-crossword';
import { parseLocalDate, type LocalDate } from '../local-date';
import type { BadgeState } from '../progress/badges';
import type { LevelState } from '../progress/levels';
import type { WeeklyRecapModel } from '../feed/weekly-recap';
import { wordGrammarText } from '../entries/part-of-speech';
import { sentences } from '../sentences';
import { withoutStress } from '../entries/stress';
import { stressLabel } from '../entries/stress-label';

/** How many members of a Synonym Row its Share Card shows. */
const SHARED_MEMBERS = 6;
/** What ends the members of a Synonym Row that has more than its Share Card shows. */
const MORE_MEMBERS = '…';

/**
 * What a Share Card shows: an Entry's card, a Weekly Recap, progress (a Level
 * reached, a Badge earned, a Streak milestone) or a solved Daily Crossword.
 * Dates are local, `YYYY-MM-DD`.
 */
export type ShareCardSubject =
  | {
      /** The Entry's card, as the Core built it for the Feed. */
      readonly card: AnyEntryCard;
      /** Whether it is today's Word of the Day, which the overline then says in place of the Category. */
      readonly todaysWordOfTheDay: boolean;
    }
  | {
      readonly recap: WeeklyRecapModel;
      /** Whether the reader hides the Streak, which the card then leaves out as the recap's card does. */
      readonly hideStreak: boolean;
    }
  | { readonly level: LevelState; readonly date: string }
  | { readonly badge: Extract<BadgeState, { readonly earned: true }> }
  | { readonly streak: number; readonly date: string }
  | { readonly crossword: DailyCrosswordState };

/**
 * The blocks of a Share Card, by what it shows, each text final, with its
 * Stress where the card draws it (ADR 0017, 0051, 0054).
 */
export type ShareCardBody =
  | {
      readonly kind: 'word';
      /** The Lemma with Stress. */
      readonly lemma: string;
      /** The part of speech with gender and registers, in the short form («ім., ж. р. · розм.»). */
      readonly grammar: string;
      readonly definition: string;
    }
  | {
      readonly kind: 'idiom';
      readonly expression: string;
      readonly definition: string;
      /** A place name's etymology, under «Походження»; undefined for any other Idiom. */
      readonly etymology: string | undefined;
    }
  | {
      readonly kind: 'correction';
      readonly nonStandardForm: string;
      /** The main standard equivalent. */
      readonly standardForm: string;
    }
  | {
      readonly kind: 'synonymRow';
      readonly dominant: string;
      readonly meaning: string;
      /** The first 6 members, in the row's order, ending in «…» when the row has more. */
      readonly members: string;
    }
  | {
      readonly kind: 'tip';
      readonly title: string;
      readonly nonStandardForm: string | undefined;
      readonly standardForm: string;
    }
  | {
      readonly kind: 'weeklyRecap';
      /** «Мій тиждень у SLOVO». */
      readonly title: string;
      /** Seen, saved, Known (when the recap has it), the Streak (when shown), the XP and the goal days (when the recap has them), in this order. */
      readonly numbers: readonly { readonly label: string; readonly count: number }[];
    }
  | {
      /** A Level reached, a Badge earned or a Streak milestone. */
      readonly kind: 'milestone';
      /** E.g. «Новий рівень у SLOVO». */
      readonly title: string;
      /** The Level's number, the Badge's name or the Streak's length. */
      readonly headline: string;
      /** The Level's name; undefined for a Badge or a Streak. */
      readonly detail: string | undefined;
    }
  | {
      readonly kind: 'dailyCrossword';
      /** «Кросворд дня розв’язано». */
      readonly title: string;
      /** The grid by row and column, `true` for a cell a word reads through; never a letter. */
      readonly grid: readonly (readonly boolean[])[];
    };

/** What a Share Card shows, built by the Core, the same in every format; the UI draws it. */
export interface ShareCardContent {
  /** What it shows, so a new one is measured afresh: the Entry's id, the Weekly Recap's week, or the progress or crossword it shows. */
  readonly shows: string;
  /**
   * Today's Word of the Day or a Word's Category, the Correction Type, the
   * chip of the Idiom Type, of a row or of a Tip, a Weekly Recap's week, or
   * the day of progress or of a Daily Crossword.
   */
  readonly overline: string | undefined;
  /** What VoiceOver reads of the card, without Stress marks. */
  readonly label: string;
  readonly body: ShareCardBody;
}

/** The texts a Share Card takes from the Edition; a Weekly Recap's spoken numbers are its Feed Notice's. */
export type ShareCardStrings = Pick<
  EditionStrings,
  | 'share'
  | 'feedNotices'
  | 'dates'
  | 'wordCard'
  | 'correctionCard'
  | 'idiomCard'
  | 'synonymRowCard'
  | 'tipCard'
>;

/**
 * The Share Card of an Entry, a Weekly Recap, progress or a solved Daily
 * Crossword, in the Edition's texts. `locale` picks the plural forms of the
 * recap's numbers and of a Streak.
 */
export function buildShareCardContent(
  subject: ShareCardSubject,
  strings: ShareCardStrings,
  locale: string,
): ShareCardContent {
  if ('recap' in subject) {
    return weeklyRecapContent(subject.recap, subject.hideStreak, strings, locale);
  }
  if ('level' in subject) {
    const { level, name } = subject.level;
    return milestoneContent(`level:${String(level)}`, subject.date, strings, {
      title: strings.share.level.title,
      headline: fill(strings.share.level.headline, { level: String(level) }),
      detail: name,
    });
  }
  if ('badge' in subject) {
    const { id, name, date } = subject.badge;
    return milestoneContent(`badge:${id}`, date, strings, {
      title: strings.share.badge.title,
      headline: name,
      detail: undefined,
    });
  }
  if ('streak' in subject) {
    const { streak, date } = subject;
    return milestoneContent(`streak:${String(streak)}`, date, strings, {
      title: strings.share.streak.title,
      headline: pluralCount(locale)(strings.share.streak.headline, streak),
      detail: undefined,
    });
  }
  if ('crossword' in subject) return dailyCrosswordContent(subject.crossword, strings);
  const { card, todaysWordOfTheDay } = subject;
  const model = card.model;
  const shows = card.entryId;
  switch (model.kind) {
    case 'word': {
      const overline = todaysWordOfTheDay ? strings.share.wordOfTheDay : model.categoryName;
      return {
        shows,
        overline,
        label: sentences([
          overline,
          stressLabel(strings.wordCard, model.lemma, model.stressedVowels),
          wordGrammarText(strings.wordCard, model, 'full'),
          // Last, as it ends with its own full stop.
          model.primaryDefinition,
        ]),
        body: {
          kind: 'word',
          lemma: model.lemma,
          grammar: wordGrammarText(strings.wordCard, model, 'short'),
          definition: model.primaryDefinition,
        },
      };
    }
    case 'idiom': {
      const overline = strings.idiomCard.idiomTypes[model.idiomType];
      const etymology = model.idiomType === 'placeName' ? model.etymology : undefined;
      return {
        shows,
        overline,
        label: sentences([
          overline,
          model.expression,
          model.primaryDefinition,
          etymology === undefined ? undefined : `${strings.idiomCard.etymology}: ${etymology}`,
        ]),
        body: {
          kind: 'idiom',
          expression: model.expression,
          definition: model.primaryDefinition,
          etymology,
        },
      };
    }
    case 'correction': {
      const overline = strings.correctionCard.correctionTypes[model.correctionType];
      return {
        shows,
        overline,
        label: sentences([
          overline,
          `${strings.share.nonStandard}: ${stressLabel(strings.wordCard, model.nonStandardForm, model.nonStandardStressedVowels)}`,
          `${strings.share.standard}: ${stressLabel(strings.wordCard, model.mainEquivalent, model.mainEquivalentStressedVowels)}`,
        ]),
        body: {
          kind: 'correction',
          nonStandardForm: model.nonStandardForm,
          standardForm: model.mainEquivalent,
        },
      };
    }
    case 'synonymRow': {
      const dominant = model.dominant.text;
      const members = `${model.members
        .slice(0, SHARED_MEMBERS)
        .map(({ text }) => text)
        .join(', ')}${model.members.length > SHARED_MEMBERS ? MORE_MEMBERS : ''}`;
      return {
        shows,
        overline: strings.synonymRowCard.chip,
        // The heading names the kind, as on the row's card, in place of the overline.
        label: sentences([
          fill(strings.synonymRowCard.heading, {
            dominant: withoutStress(dominant),
            members: withoutStress(members),
          }),
          model.meaning,
        ]),
        body: { kind: 'synonymRow', dominant, meaning: model.meaning, members },
      };
    }
    case 'tip':
      return {
        shows,
        overline: strings.tipCard.chip,
        // The heading names the kind, as on the Tip's card, in place of the overline.
        label: sentences([
          fill(strings.tipCard.heading, { title: withoutStress(model.title) }),
          model.nonStandardForm === undefined
            ? undefined
            : `${strings.share.nonStandard}: ${withoutStress(model.nonStandardForm)}`,
          `${strings.share.standard}: ${withoutStress(model.standardForm)}`,
        ]),
        body: {
          kind: 'tip',
          title: model.title,
          nonStandardForm: model.nonStandardForm,
          standardForm: model.standardForm,
        },
      };
  }
}

/**
 * A Weekly Recap's Share Card (ADR 0054): the title, the week's dates as its
 * overline and the recap's numbers, with no words, without the Streak while
 * the reader hides it.
 */
function weeklyRecapContent(
  recap: WeeklyRecapModel,
  hideStreak: boolean,
  strings: ShareCardStrings,
  locale: string,
): ShareCardContent {
  const texts = strings.share.weeklyRecap;
  const labels = strings.feedNotices.weeklyRecap;
  const { spoken } = labels;
  const countOf = pluralCount(locale);
  const { firstDay, lastDay, seen, saved, known, streak, xp, goalDays } = recap;
  const monthOf = ({ month }: LocalDate) => strings.dates.months[month - 1] ?? '';
  const week =
    firstDay.month === lastDay.month
      ? fill(texts.week, {
          from: String(firstDay.day),
          to: String(lastDay.day),
          month: monthOf(lastDay),
        })
      : fill(texts.weekAcrossMonths, {
          from: String(firstDay.day),
          fromMonth: monthOf(firstDay),
          to: String(lastDay.day),
          toMonth: monthOf(lastDay),
        });
  const numbers = [
    { label: labels.seen, count: seen, spoken: spoken.seen },
    { label: labels.saved, count: saved, spoken: spoken.saved },
    ...(known === undefined ? [] : [{ label: labels.known, count: known, spoken: spoken.known }]),
    ...(hideStreak ? [] : [{ label: labels.streak, count: streak, spoken: spoken.streak }]),
    ...(xp === undefined ? [] : [{ label: labels.xp, count: xp, spoken: spoken.xp }]),
    ...(goalDays === undefined
      ? []
      : [{ label: labels.goalDays, count: goalDays, spoken: spoken.goalDays }]),
  ];
  return {
    shows: week,
    overline: week,
    label: sentences([
      week,
      texts.title,
      ...numbers.map((number) => countOf(number.spoken, number.count)),
    ]),
    body: {
      kind: 'weeklyRecap',
      title: texts.title,
      numbers: numbers.map(({ label, count }) => ({ label, count })),
    },
  };
}

/** A local date, `YYYY-MM-DD`, as a progress or crossword Share Card's overline, e.g. «1 листопада». */
function dayText(date: string, strings: ShareCardStrings): string {
  const { day, month } = parseLocalDate(date);
  return fill(strings.share.day, {
    day: String(day),
    month: strings.dates.months[month - 1] ?? '',
  });
}

/** The Share Card of a Level reached, a Badge earned or a Streak milestone, on its day. */
function milestoneContent(
  shows: string,
  date: string,
  strings: ShareCardStrings,
  texts: { title: string; headline: string; detail: string | undefined },
): ShareCardContent {
  const overline = dayText(date, strings);
  return {
    shows,
    overline,
    label: sentences([overline, texts.title, texts.headline, texts.detail]),
    body: { kind: 'milestone', ...texts },
  };
}

/**
 * A solved Daily Crossword's Share Card: which cells its words read through,
 * with no letter and no clue, so it gives no answer away.
 */
function dailyCrosswordContent(
  crossword: DailyCrosswordState,
  strings: ShareCardStrings,
): ShareCardContent {
  const texts = strings.share.dailyCrossword;
  const grid = Array.from({ length: CROSSWORD_SIZE }, () =>
    Array.from({ length: CROSSWORD_SIZE }, () => false),
  );
  for (const { start, direction, length } of crossword.words) {
    for (let i = 0; i < length; i++) {
      const row = direction === 'across' ? start.row : start.row + i;
      const column = direction === 'across' ? start.column + i : start.column;
      const cells = grid[row];
      if (cells !== undefined && column < CROSSWORD_SIZE) cells[column] = true;
    }
  }
  const overline = dayText(crossword.date, strings);
  return {
    shows: `crossword:${crossword.date}`,
    overline,
    label: sentences([overline, texts.title, texts.grid]),
    body: { kind: 'dailyCrossword', title: texts.title, grid },
  };
}
