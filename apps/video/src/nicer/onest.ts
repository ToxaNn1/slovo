/**
 * The advance widths of Onest SemiBold, in em (read from the font's hmtx
 * table). They let a bubble know how wide its text is, so it can grow from
 * the usual answer to the nicer word without measuring text in the browser.
 */
const advance: Record<string, number> = {
  а: 0.563, б: 0.596, в: 0.559, г: 0.45, ґ: 0.459, д: 0.613, е: 0.574, є: 0.552, ж: 0.792, з: 0.526, и: 0.606,
  і: 0.257, ї: 0.24, й: 0.606, к: 0.553, л: 0.57, м: 0.719, н: 0.582, о: 0.597, п: 0.583, р: 0.613, с: 0.559,
  т: 0.489, у: 0.563, ф: 0.756, х: 0.545, ц: 0.602, ч: 0.541, ш: 0.819, щ: 0.842, ь: 0.538, ю: 0.807, я: 0.559,
  А: 0.698, Б: 0.669, В: 0.669, Г: 0.579, Ґ: 0.579, Д: 0.727, Е: 0.618, Є: 0.714, Ж: 0.919, З: 0.646, И: 0.747,
  І: 0.283, Ї: 0.283, Й: 0.747, К: 0.657, Л: 0.698, М: 0.887, Н: 0.737, О: 0.769, П: 0.736, Р: 0.643, С: 0.717,
  Т: 0.586, У: 0.636, Ф: 0.859, Х: 0.643, Ц: 0.736, Ч: 0.678, Ш: 0.985, Щ: 1.004, Ь: 0.652, Ю: 1.006, Я: 0.688,
  ' ': 0.278, ',': 0.288, '.': 0.272, '!': 0.294, '?': 0.524, '…': 0.74, '—': 0.797, '’': 0.283, '-': 0.462,
  '«': 0.534, '»': 0.534, ':': 0.274,
};

/** A character the table doesn't know is taken as a wide one, so a bubble errs on the roomy side. */
const unknown = 0.85;

/** The width of one character of Onest SemiBold, in em. */
export const charInEm = (char: string) => advance[char] ?? unknown;

/** The width of `text` in Onest SemiBold, in em (no kerning: the letters are set one by one). */
export function onestInEm(text: string) {
  let sum = 0;
  for (const char of text) sum += charInEm(char);
  return sum;
}
