import { z } from 'zod';

import { GenderSchema, PartOfSpeechSchema, RegisterSchema } from '../word';
import { LabelSchema, templateOf, TextSchema } from './shared';

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
  /** The label before the non-standard forms of the linked Corrections. */
  oftenSaid: TextSchema,
  /** What VoiceOver says a linked Correction's form does when tapped, e.g. "Відкриває виправлення". */
  oftenSaidHint: TextSchema,
});
