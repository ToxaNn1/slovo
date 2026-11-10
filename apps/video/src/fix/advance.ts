/**
 * The advance widths of Unbounded Black's capitals, in em (read from the
 * font's hmtx table). They let a video lay a phrase out and fit it to the
 * safe zone without measuring text in the browser.
 */
const advance: Record<string, number> = {
  А: 0.996, Б: 0.864, В: 0.907, Г: 0.681, Ґ: 0.681, Д: 1.104, Е: 0.812, Є: 0.956, Ж: 1.418, З: 0.873, И: 1.007,
  І: 0.378, Ї: 0.378, Й: 1.007, К: 0.895, Л: 1.019, М: 1.275, Н: 0.956, О: 0.976, П: 0.952, Р: 0.837, С: 0.949,
  Т: 0.84, У: 0.94, Ф: 1.286, Х: 0.922, Ц: 1.044, Ч: 0.916, Ш: 1.374, Щ: 1.474, Ь: 0.837, Ю: 1.326, Я: 0.884,
  ' ': 0.236, ',': 0.33, '.': 0.328, '!': 0.352, '?': 0.739, '…': 0.95, '—': 1.23, '’': 0.323, '-': 0.6,
};

/** A capital the table doesn't know is taken as a wide one, so a row errs on the narrow side. */
const unknown = 1.1;

/** The width of `text` in capitals of Unbounded Black, in em. */
export function widthInEm(text: string) {
  let sum = 0;
  for (const char of text.toUpperCase()) sum += advance[char] ?? unknown;
  return sum;
}
