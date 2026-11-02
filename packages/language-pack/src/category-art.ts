import type { EditionConfig, EditionDecor } from '@slovo/contracts';

import type { BuildError } from './build-error';

const DECOR_FILE = 'decor/decor.json';

/**
 * Why the Edition's Category art is incomplete: once its Decor draws Category
 * art, every Category and Correction Category needs its pictogram and cover,
 * and no art may name an id that is neither.
 */
export function categoryArtErrors(
  { categories, correctionCategories }: EditionConfig,
  decor: EditionDecor | undefined,
): BuildError[] {
  const art = decor?.categories;
  if (art === undefined) return [];
  const refuse = (id: string, message: string): BuildError => ({
    file: DECOR_FILE,
    field: `categories.${id}`,
    message,
  });
  const missing = (kind: string, list: readonly { id: string }[]) =>
    list
      .filter(({ id }) => !Object.hasOwn(art, id))
      .map(({ id }) => refuse(id, `No pictogram and cover for the ${kind} ${id}`));
  const known = new Set([...categories, ...correctionCategories].map(({ id }) => id));
  return [
    ...missing('Category', categories),
    ...missing('Correction Category', correctionCategories),
    ...Object.keys(art)
      .filter((id) => !known.has(id))
      .map((id) =>
        refuse(id, `Art for ${id}, which is no Category or Correction Category of the Edition`),
      ),
  ];
}
