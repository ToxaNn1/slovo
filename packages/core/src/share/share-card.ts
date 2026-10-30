import { fill, type EditionStrings } from '@slovo/contracts';

import type { AnyEntryCard } from '../feed/entry-feed-card';
import type { LocalDate } from '../local-date';
import type { WeeklyRecapModel } from '../progress/weekly-recap';
import { wordGrammarText } from '../entries/part-of-speech';
import { sentences } from '../sentences';
import { withoutStress } from '../entries/stress';
import { stressLabel } from '../entries/stress-label';

/** How many members of a Synonym Row its Share Card shows. */
const SHARED_MEMBERS = 6;
/** What ends the members of a Synonym Row that has more than its Share Card shows. */
const MORE_MEMBERS = '…';

/** What a Share Card shows: an Entry's card or a Weekly Recap. */
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
    };

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
      /** Seen, saved, Known (when the recap has it) and the Streak (when shown), in this order. */
      readonly numbers: readonly { readonly label: string; readonly count: number }[];
    };

/** What a Share Card shows, built by the Core, the same in every format; the UI draws it. */
export interface ShareCardContent {
  /** What it shows, so a new one is measured afresh: the Entry's id, or the Weekly Recap's week. */
  readonly shows: string;
  /**
   * Today's Word of the Day or a Word's Category, the Correction Type, the
   * chip of the Idiom Type, of a row or of a Tip, or a Weekly Recap's week.
   */
  readonly overline: string | undefined;
  /** What VoiceOver reads of the card, without Stress marks. */
  readonly label: string;
  readonly body: ShareCardBody;
}

/** The texts a Share Card takes from the Edition. */
export type ShareCardStrings = Pick<
  EditionStrings,
  'share' | 'wordCard' | 'correctionCard' | 'idiomCard' | 'synonymRowCard' | 'tipCard'
>;

/** The Share Card of an Entry or of a Weekly Recap, in the Edition's texts. */
export function buildShareCardContent(
  subject: ShareCardSubject,
  strings: ShareCardStrings,
): ShareCardContent {
  if ('recap' in subject) return weeklyRecapContent(subject.recap, subject.hideStreak, strings);
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
): ShareCardContent {
  const texts = strings.share.weeklyRecap;
  const { firstDay, lastDay, seen, saved, known, streak } = recap;
  const monthOf = ({ month }: LocalDate) => texts.months[month - 1] ?? '';
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
    { label: texts.seen, count: seen },
    { label: texts.saved, count: saved },
    ...(known === undefined ? [] : [{ label: texts.known, count: known }]),
    ...(hideStreak ? [] : [{ label: texts.streak, count: streak }]),
  ];
  return {
    shows: week,
    overline: week,
    label: sentences([
      week,
      texts.title,
      ...numbers.map(({ label, count }) => `${String(count)} ${label}`),
    ]),
    body: { kind: 'weeklyRecap', title: texts.title, numbers },
  };
}
