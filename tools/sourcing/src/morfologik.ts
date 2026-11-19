/**
 * Reads the Lemma forms out of a morfologik dictionary, the CFSA2 automaton
 * LanguageTool's Ukrainian dictionary ships (`ukrainian.dict` in
 * `morfologik-ukrainian-lt`, built from dict_uk). Each sequence the automaton
 * holds is `<form>+<Lemma>+<tags>`, the Lemma SUFFIX-encoded on the form's
 * bytes: its first byte minus `A` is how many bytes to cut off the form's
 * end (255: all of them), the rest is what to append.
 */
const MAGIC = '\\fsa';
const CFSA2_VERSION = 0xc6;
const SEPARATOR = 0x2b; // "+"
const REMOVE_EVERYTHING = 255;

const BIT_TARGET_NEXT = 0x80;
const BIT_LAST_ARC = 0x40;
const BIT_FINAL_ARC = 0x20;
const LABEL_INDEX_MASK = 0x1f;

/** The parts of speech whose Lemma forms are listed. */
const LISTED_POS = new Set(['noun', 'verb', 'adj', 'adv']);

/**
 * The headword list: one line `<lemma>\t<tags>` per entry whose form is its
 * own Lemma, for nouns, verbs, adjectives and adverbs, without repeats.
 */
export function headwordList(dict: Uint8Array): string {
  const lines = new Set<string>();
  const decoder = new TextDecoder();
  for (const sequence of sequences(dict)) {
    const first = sequence.indexOf(SEPARATOR);
    const second = sequence.indexOf(SEPARATOR, first + 1);
    if (first < 0 || second < 0) continue;
    const tags = decoder.decode(sequence.subarray(second + 1));
    if (!LISTED_POS.has(tags.split(':')[0] ?? '')) continue;
    const form = sequence.subarray(0, first);
    const code = sequence[first + 1] ?? 0;
    const cut = (code - 0x41) & 0xff;
    const append = sequence.subarray(first + 2, second);
    // The form is its own Lemma when nothing is cut and nothing appended.
    const ownLemma =
      (cut === 0 && append.length === 0) || (cut === REMOVE_EVERYTHING && equalBytes(append, form));
    if (ownLemma) lines.add(`${decoder.decode(form)}\t${tags}`);
  }
  return [...lines].join('\n');
}

function equalBytes(a: Uint8Array, b: Uint8Array): boolean {
  return a.length === b.length && a.every((byte, index) => byte === b[index]);
}

/** Every byte sequence the CFSA2 automaton accepts. */
function* sequences(dict: Uint8Array): Generator<Uint8Array> {
  const magic = new TextDecoder().decode(dict.subarray(0, 4));
  if (magic !== MAGIC || dict[4] !== CFSA2_VERSION)
    throw new Error('Not a morfologik CFSA2 dictionary');
  const mappingSize = dict[7] ?? 0;
  const labels = dict.subarray(8, 8 + mappingSize);
  const arcs = dict.subarray(8 + mappingSize);
  const at = (offset: number) => arcs[offset] ?? 0;
  const isLast = (arc: number) => (at(arc) & BIT_LAST_ARC) !== 0;
  const label = (arc: number) => {
    const index = at(arc) & LABEL_INDEX_MASK;
    return index > 0 ? (labels[index] ?? 0) : at(arc + 1);
  };
  const skipArc = (arc: number) => {
    const flag = at(arc);
    let offset = arc + 1;
    if ((flag & LABEL_INDEX_MASK) === 0) offset += 1;
    if ((flag & BIT_TARGET_NEXT) === 0) {
      while ((at(offset) & 0x80) !== 0) offset += 1;
      offset += 1;
    }
    return offset;
  };
  const target = (arc: number) => {
    if ((at(arc) & BIT_TARGET_NEXT) !== 0) {
      let last = arc;
      while (!isLast(last)) last = skipArc(last);
      return skipArc(last);
    }
    let offset = arc + ((at(arc) & LABEL_INDEX_MASK) === 0 ? 2 : 1);
    let value = 0;
    for (let shift = 0; ; shift += 7) {
      const byte = at(offset);
      value += (byte & 0x7f) * 2 ** shift;
      offset += 1;
      if ((byte & 0x80) === 0) return value;
    }
  };

  const buffer = new Uint8Array(1024);
  // An explicit stack of [arc, depth]: the automaton is too deep and wide to recurse.
  const stack: [number, number][] = [[target(0), 0]];
  for (let top = stack.pop(); top !== undefined; top = stack.pop()) {
    const [arc, depth] = top;
    buffer[depth] = label(arc);
    if (!isLast(arc)) stack.push([skipArc(arc), depth]);
    if ((at(arc) & BIT_FINAL_ARC) !== 0) yield buffer.slice(0, depth + 1);
    const next = target(arc);
    if (next !== 0) stack.push([next, depth + 1]);
  }
}
