import { z } from 'zod';

import { GenderSchema, PartOfSpeechSchema, RegisterSchema } from '../word';
import { TextSchema } from '../shared';
import { LabelSchema, pluralOf, templateOf } from './shared';

export const WordCardStringsSchema = z.strictObject({
  /** What VoiceOver says after the Lemma about its Stress, e.g. "наголос на {vowels}". */
  stress: templateOf('vowels'),
  /** The word between two valid stressed vowels, e.g. "або". */
  stressOr: TextSchema,
  /** The Pronunciation button and its missing-voice message. */
  pronunciation: z.strictObject({
    /** The button's VoiceOver label, e.g. "Вимова". */
    label: TextSchema,
    /** Its VoiceOver label while the Lemma is being spoken, e.g. "Зупинити вимову". */
    stop: TextSchema,
    /** Shown when the device has no voice for the Edition's language. */
    noVoice: TextSchema,
  }),
  /** Every part of speech, e.g. "ім." / "іменник". */
  partsOfSpeech: z.record(PartOfSpeechSchema, LabelSchema),
  /** Every gender of a noun, e.g. "ж. р." / "жіночий рід". */
  genders: z.record(GenderSchema, LabelSchema),
  /** How a part of speech and a gender join, e.g. "{partOfSpeech}, {gender}". */
  partOfSpeechWithGender: templateOf('partOfSpeech', 'gender'),
  /** Every register label, e.g. "заст." / "застаріле". */
  registers: z.record(RegisterSchema, LabelSchema),
  /** How the dialectal register label and a Word's region join, e.g. "{register}, {region}". */
  registerWithRegion: templateOf('register', 'region'),
  /** An Example as the card quotes it, e.g. "«{text}»". */
  example: templateOf('text'),
  /** The line under an Example that names its author, e.g. "— {author}". */
  exampleAuthor: templateOf('author'),
  /** The label before one Synonym, and before several. */
  synonym: TextSchema,
  synonyms: TextSchema,
  /** The label before one antonym, and before several. */
  antonym: TextSchema,
  antonyms: TextSchema,
  /** The VoiceOver label of the Category chip, e.g. "Категорія: {category}". */
  category: templateOf('category'),
  /** The button that opens the details. */
  more: TextSchema,
  /** The headings inside the details. */
  etymology: TextSchema,
  extraDefinitions: TextSchema,
  moreExamples: TextSchema,
  /** The button under a tab too long for its card's frame, on every kind of card, which opens the rest of the tab (ADR 0088). */
  tabMore: TextSchema,
  /** The names of the Word card's tabs (ADR 0088). */
  tabs: z.strictObject({
    essence: TextSchema,
    example: TextSchema,
    links: TextSchema,
    history: TextSchema,
  }),
  /** The labels over the Synonyms and antonyms in «Зв’язки», for one and for several, e.g. "Синонім" / "Синоніми" (board p1). */
  linkLabels: z.strictObject({
    synonyms: z.strictObject({ one: TextSchema, many: TextSchema }),
    antonyms: z.strictObject({ one: TextSchema, many: TextSchema }),
  }),
  /** The line under the Definition in «Суть» that names the other meanings in «Історія», e.g. "Ще {count} значення — у вкладці «Історія»." (ADR 0088). */
  moreMeanings: pluralOf(),
  /** The heading of the Word History on the card, e.g. "Історія слова". */
  history: TextSchema,
  /** The label before the non-standard forms of the linked Corrections. */
  oftenSaid: TextSchema,
  /** What VoiceOver says a linked Correction's form does when tapped, e.g. "Відкриває виправлення". */
  oftenSaidHint: TextSchema,
  /** The line of the Synonym Row the Word is a member of, e.g. "У синонімічному ряду: {dominant}" (ADR 0051). */
  synonymRow: templateOf('dominant'),
  /** What VoiceOver says the Synonym Row line does when tapped, e.g. "Відкриває синонімічний ряд". */
  synonymRowHint: TextSchema,
  /** What VoiceOver reads for the Illustration, e.g. "Ілюстрація до слова {lemma}". */
  illustration: templateOf('lemma'),
  /** Self-check: the button that reveals a hidden Word card's meaning, e.g. "Показати значення". */
  reveal: TextSchema,
});
