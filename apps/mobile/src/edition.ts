import { PartOfSpeechSchema } from '@slovo/contracts';
import { loadEdition } from '@slovo/core';
import config from 'slovo-edition/config';
import strings from 'slovo-edition/strings';
import { z } from 'zod';

/** The UI text the shell needs, in the Edition's language. */
const EditionStringsSchema = z.strictObject({
  tabs: z.strictObject({
    home: z.string().min(1),
    settings: z.string().min(1),
    game: z.string().min(1),
    saved: z.string().min(1),
  }),
  placeholder: z.string().min(1),
  loadFailed: z.string().min(1),
  noWords: z.string().min(1),
  partsOfSpeech: z.record(PartOfSpeechSchema, z.string().min(1)),
});

/** The Edition this build runs as, validated by the Core at startup. */
export const edition = loadEdition(config);

export const editionStrings = EditionStringsSchema.parse(strings);
