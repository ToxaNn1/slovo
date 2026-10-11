/**
 * The contracts: the single definition of every shape shared across the
 * factory (Entries, the Edition config, the Language Pack, the API).
 */
export {
  CategorySchema,
  EditionConfigSchema,
  LanguageTraitsSchema,
  type Category,
  type EditionConfig,
  type LanguageTraits,
} from './edition';
export { PartOfSpeechSchema, WordSchema, type PartOfSpeech, type Word } from './word';
