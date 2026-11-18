import { fill, type EditionStrings } from '@slovo/contracts';

/** The Rarity Range in the Edition's words: «від 1 до 3», or «лише 3» when both ends are one. */
export function rarityRangeLabel(
  texts: Pick<EditionStrings['settings']['rarity'], 'range' | 'single'>,
  { from, to }: { readonly from: number; readonly to: number },
): string {
  return from === to
    ? fill(texts.single, { rarity: String(from) })
    : fill(texts.range, { from: String(from), to: String(to) });
}
