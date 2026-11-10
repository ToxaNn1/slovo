/** The name of each content rule; a refusal names the rule it breaks. */
export type RuleName =
  | 'schema'
  | 'duplicate-id'
  | 'mixed-script'
  | 'stray-character'
  | 'unique-lemma'
  | 'unique-expression'
  | 'unique-synonym-text'
  | 'stress'
  | 'marks-stress'
  | 'wrong-stress'
  | 'public-domain'
  | 'unique-tip-answers'
  | 'word-category'
  | 'correction-category'
  | 'word-correction'
  | 'category-history'
  | 'word-origin'
  | 'synonym-row-word'
  | 'curated-collection-entry'
  | 'crossword-day-entry'
  | 'crossword-days-gap'
  | 'crossword-days-repeat'
  | 'crossword-days-immutable'
  | 'illustration-png'
  | 'illustration-size'
  | 'illustration-square';

/** One record a rule refuses, located as precisely as possible. */
export interface Refusal {
  readonly rule: RuleName;
  /** The file of the record at fault, relative to the Edition folder. */
  readonly file: string;
  readonly entryId?: string;
  /** The dotted path of the field at fault. */
  readonly field?: string;
  readonly message: string;
}

/** A record that passed its schema, with the file it was authored in. */
export interface Authored<T extends { readonly id: string }> {
  readonly file: string;
  readonly entry: T;
}
