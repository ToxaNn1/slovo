import { EditionConfigSchema, type LanguageTraits } from '@slovo/contracts';

/** What the Core knows about the Edition it runs as. */
export interface Edition {
  readonly id: string;
  readonly locale: string;
  readonly languageTraits: LanguageTraits;
}

/** Thrown when an Edition config doesn't match the contracts. */
export class InvalidEditionConfigError extends Error {
  override readonly name = 'InvalidEditionConfigError';
}

/**
 * Validates an Edition config and reports the Edition. Every feature asks the
 * Edition returned here instead of reading the config directly.
 */
export function loadEdition(config: unknown): Edition {
  const result = EditionConfigSchema.safeParse(config);
  if (!result.success) {
    const problems = result.error.issues.map(
      (issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`,
    );
    throw new InvalidEditionConfigError(`Invalid Edition config:\n${problems.join('\n')}`);
  }
  const { id, locale, languageTraits } = result.data;
  return { id, locale, languageTraits };
}
