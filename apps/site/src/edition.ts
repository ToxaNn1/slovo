import { EditionStringsSchema, EditionTokensSchema, MascotFigureSchema } from '@slovo/contracts';
import { EDITIONS_DIR, openEditionWithoutRecords } from '@slovo/language-pack/edition';
import { z } from 'zod';

/** The Edition the landing belongs to: the UA Edition (ADR 0071). */
export const LANDING_EDITION = 'uk';

/**
 * What the landing takes from its Edition: the palette, the fonts, the Mascot,
 * and the labels a Word page names a part of speech and a gender by.
 */
export const LandingEditionSchema = z.object({
  tokens: EditionTokensSchema.required({ colors: true, fontFamilies: true }),
  mascot: MascotFigureSchema,
  wordCard: EditionStringsSchema.shape.wordCard.pick({
    partsOfSpeech: true,
    genders: true,
    partOfSpeechWithGender: true,
  }),
});

export type LandingEdition = z.output<typeof LandingEditionSchema>;

/**
 * Reads the landing's Edition through the Edition folder module (ADR 0035),
 * where it enters the site. Runs in Node, at the content sync: a page reads
 * the result from the `edition` collection.
 */
export function readLandingEdition(): LandingEdition {
  const edition = openEditionWithoutRecords(EDITIONS_DIR, LANDING_EDITION);
  const { partsOfSpeech, genders, partOfSpeechWithGender } = edition.read('strings').wordCard;
  return LandingEditionSchema.parse({
    tokens: edition.read('tokens'),
    mascot: edition.read('decor').mascot,
    wordCard: { partsOfSpeech, genders, partOfSpeechWithGender },
  });
}
