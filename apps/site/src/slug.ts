import { STRESS_MARK } from '@slovo/contracts';

/** Letters spelled one way wherever they stand (the official transliteration, KMU 2010). */
const LETTERS: Readonly<Record<string, string>> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'h',
  ґ: 'g',
  д: 'd',
  е: 'e',
  є: 'ie',
  ж: 'zh',
  з: 'z',
  и: 'y',
  і: 'i',
  ї: 'i',
  й: 'i',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'kh',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh',
  щ: 'shch',
  ь: '',
  ю: 'iu',
  я: 'ia',
};

/** The letters spelled otherwise at the start of a word. */
const INITIAL: Readonly<Record<string, string>> = { є: 'ye', ї: 'yi', й: 'y', ю: 'yu', я: 'ya' };

const APOSTROPHES = new Set(["'", '’', 'ʼ']);

/**
 * A Lemma's slug, the last part of its page's address: the official
 * transliteration (KMU 2010) with «зг» as «zgh», lower case, Stress marks and
 * apostrophes dropped, every other mark a hyphen.
 */
export function slugOf(lemma: string): string {
  const letters = Array.from(lemma.toLowerCase().replaceAll(STRESS_MARK, ''));
  const spelled = letters.map((letter, i) => {
    const previous = letters[i - 1];
    const initial = previous === undefined || !(previous in LETTERS || APOSTROPHES.has(previous));
    if (APOSTROPHES.has(letter)) return '';
    if (letter === 'г' && previous === 'з') return 'gh';
    const spelling = (initial ? INITIAL[letter] : undefined) ?? LETTERS[letter];
    if (spelling !== undefined) return spelling;
    return /[a-z0-9]/.test(letter) ? letter : '-';
  });
  return spelled.join('').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

/**
 * Every Word's slug by its id. Two Lemmas with one slug share it in id
 * order: the first keeps it, the next take «-2», «-3» and on.
 */
export function slugsById(words: readonly { id: string; lemma: string }[]): Map<string, string> {
  const taken = new Set<string>();
  const slugs = new Map<string, string>();
  for (const word of [...words].sort((a, b) => (a.id < b.id ? -1 : 1))) {
    const base = slugOf(word.lemma) || word.id;
    let slug = base;
    for (let n = 2; taken.has(slug); n += 1) slug = `${base}-${String(n)}`;
    taken.add(slug);
    slugs.set(word.id, slug);
  }
  return slugs;
}
