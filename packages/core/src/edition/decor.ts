import {
  EditionDecorSchema,
  type CategoryArt,
  type EditionDecor,
  type MascotAccessory,
  type MascotFigure,
} from '@slovo/contracts';

/**
 * The Decor the app draws (ADR 0014, `docs/design/README.md`): the Mascot, the
 * Season's or Holiday's accessory it wears, and the Category art. A part the
 * Decor leaves out shows nothing. Shapes and colours only: Decor never
 * carries text or behaviour.
 */
export interface Decor {
  /** The Mascot's vector (ADR 0070); without it the Mascot is its line alone. */
  readonly mascot: MascotFigure | undefined;
  /** The Season's or Holiday's accessory the Mascot wears while seasonal Decor is on. */
  readonly mascotAccessory: MascotAccessory | undefined;
  /** The pictogram and cover of each Category and Correction Category, by its id. */
  readonly categories: Readonly<Record<string, CategoryArt>> | undefined;
}

/** The Core's Decor: nothing, for an Edition that brings none. */
export const coreDecor: Decor = {
  mascot: undefined,
  mascotAccessory: undefined,
  categories: undefined,
};

/** Thrown when an Edition's Decor doesn't match the contracts. */
export class InvalidDecorError extends Error {
  override readonly name = 'InvalidDecorError';
}

/** Validates an Edition's Decor as the contracts define it. */
export function parseDecor(decor: unknown): EditionDecor {
  const result = EditionDecorSchema.safeParse(decor ?? {});
  if (!result.success) {
    const problems = result.error.issues.map(
      (issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`,
    );
    throw new InvalidDecorError(`Invalid Decor:\n${problems.join('\n')}`);
  }
  return result.data;
}

/**
 * Validates an Edition's Decor and gives what the app draws of it. An Edition
 * without Decor gets the Core's, which draws nothing.
 */
export function loadDecor(decor: unknown): Decor {
  const { mascot, categories } = parseDecor(decor);
  return { mascot, mascotAccessory: undefined, categories };
}
