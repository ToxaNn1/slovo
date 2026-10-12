import { z } from 'zod';

import { CorrectionTypeSchema } from './correction';
import { FontSizeSchema, ThemeSchema } from './edition';
import { GenderSchema, PartOfSpeechSchema, RegisterSchema } from './word';

const TextSchema = z.string().min(1);

/** A label in two forms: short for the screen, full for VoiceOver. */
const LabelSchema = z.strictObject({
  /** The dictionary abbreviation the card shows, e.g. "ім.". */
  short: TextSchema,
  /** The whole word VoiceOver reads, e.g. "іменник". */
  full: TextSchema,
});

/** Text with `{name}` placeholders that must all be present. */
const templateOf = (...names: readonly string[]) =>
  TextSchema.refine(
    (text) => names.every((name) => text.includes(`{${name}}`)),
    `Expected the placeholders ${names.map((name) => `{${name}}`).join(', ')}`,
  );

/**
 * The UI text of an Edition, in its language: `editions/<edition>/strings.json`.
 * Core screens read every text from here, never from code.
 */
export const EditionStringsSchema = z.strictObject({
  tabs: z.strictObject({
    home: TextSchema,
    settings: TextSchema,
    game: TextSchema,
    saved: TextSchema,
  }),
  /** Shown on a screen that a later version builds. */
  placeholder: TextSchema,
  /** Shown when the Language Pack can't be read. */
  loadFailed: TextSchema,
  /** Shown when the Language Pack holds no Words. */
  noWords: TextSchema,
  /** The end-of-Cycle card, shown once the reader has Seen every live Entry. */
  endOfCycle: z.strictObject({
    title: TextSchema,
    /** Asks the reader to wait for new Entries and says the next swipe starts a new Cycle. */
    message: TextSchema,
  }),
  /** The badge on the card of the Word of the Day. */
  wordOfTheDay: z.strictObject({
    /** The badge text; `{day}` stands for the day of the month and `{month}` for its name. */
    badge: TextSchema,
    /** The month names as the badge uses them, January first. */
    months: z.array(TextSchema).length(12),
  }),
  /** The words on the splash, under the Edition's mark. */
  splash: z.strictObject({
    /** The app's name as a wordmark, e.g. "SLOVO". */
    wordmark: TextSchema,
    tagline: TextSchema,
  }),
  settings: z.strictObject({
    /** The Settings screen title. */
    title: TextSchema,
    /** The label over the Theme choice. */
    theme: TextSchema,
    /** The name of every Theme. */
    themes: z.record(ThemeSchema, TextSchema),
    /** The label over the font-size choice. */
    fontSize: TextSchema,
    /** The name of every font size. */
    fontSizes: z.record(FontSizeSchema, TextSchema),
    /** The sample Word the font-size preview shows. */
    fontSizePreview: z.strictObject({
      /** The sample Lemma, Stress marks included. */
      lemma: TextSchema,
      definition: TextSchema,
    }),
  }),
  wordCard: z.strictObject({
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
  }),
  correctionCard: z.strictObject({
    /** The overline at the top of the card, e.g. "Виправлення". */
    title: TextSchema,
    /** The name of every Correction Type, e.g. "калька". */
    correctionTypes: z.record(CorrectionTypeSchema, TextSchema),
    /** The VoiceOver label of the Correction Type chip, e.g. "Тип: {type}". */
    correctionType: templateOf('type'),
    /** The label over the non-standard form, e.g. "Так часто кажуть". */
    nonStandard: TextSchema,
    /** The label over the main standard equivalent, e.g. "Українською краще". */
    standard: TextSchema,
    /** The line with the other standard equivalents, e.g. "також: {equivalents}". */
    otherEquivalents: templateOf('equivalents'),
    /** What VoiceOver says for each sentence of the example pair. */
    exampleNonStandard: templateOf('text'),
    exampleStandard: templateOf('text'),
  }),
});

export type EditionStrings = z.infer<typeof EditionStringsSchema>;
