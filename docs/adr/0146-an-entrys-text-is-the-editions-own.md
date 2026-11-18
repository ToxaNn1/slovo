---
summary: Every Entry's text is the Edition's own plain Ukrainian, nothing copied from a dictionary, `sources` «Власна лексикографічна редакція», authors only from the public domain; rarity (Words only) by `wordfreq` Zipf on bands of the collection (≥2.5 / 1.93 / 1.48 / >0 / absent → 1–5), +1 for archaic or dialectal, the editor ±1 with a reason, a Word absent from the corpus lowered 1–2 when it is known; NFC and the schema always; nothing written before the owner's yes (amends 0090 for agents); new content gathered with 30% to spare, deduplicated against the snapshot; per-kind rules: Words 1–4 synonyms of their part of speech and 2–3 Examples, Corrections one standard equivalent in the same grammatical form, Idioms an exact Idiom Type and a real figurative meaning, Synonym Rows mixed in tone, Tips readable in seconds with their exceptions; existing Entries rewritten in batches through the admin API (supersedes the earlier quoting rules; amends 0090 and 0094).
---

# An Entry's text is the Edition's own

Status: accepted (owner, 15.11). Supersedes the earlier quoting rules; amends ADRs 0090 and 0094.

## Context

The earlier rules had Definitions and Examples copied word for word from СУМ through goroh, and ADR 0094 limited each quotation to one sentence that always names its dictionary. In practice Entries shipped whole dictionary articles: Definitions as СУМ words them, its abbreviations («перев.», «заст.»), etymologies of a thousand characters with «псл.» and reference lists, and Examples by authors whose works are still protected. The owner wants the text to be the Edition's own work, easy for a reader, and free of any claim from a dictionary's rights holder. A dry run on 10 Words (15.11) showed the result and the owner accepted its quality; the owner then set the rules for the other four kinds.

## Decision

### Every kind

- Every Definition, meaning, explanation, etymology and history is written by the Edition in plain modern literary Ukrainian. Nothing is copied from a dictionary: no sentence, no construction, no dictionary abbreviation.
- `sources` is `[{ "title": "Власна лексикографічна редакція" }]`: no address, no dictionary name. Dictionaries stay working material for the editor, never shipped text.
- An Example or a Literary Use by an author stays only when the author is in the public domain (died 70 or more years ago, as the public-domain rule has it) and the sentence is apt, not coarse or bleak, cleaned of editorial brackets and «..» cuts.
- Rarity, 1 «чув, не вживаю» to 5 «майже ніхто не знає», follows present-day frequency and recognisability. Only Words carry one; the other kinds have no rarity. How a Word's rarity is set is under Words.
- Every text is in Unicode NFC, and every record matches its schema in `packages/contracts` before it is shown or written.
- **Nothing is written before the owner confirms it.** An agent shows the result first: «БУЛО / СТАЛО» for a revision, the list of candidates for new content; it writes only after the owner's yes in the current conversation. This replaces, for agents, ADR 0090's «agents publish at once».

### Words

- `primaryDefinition` is one or two sentences; `extraDefinitions` stays `[]` for a Word of one meaning. `etymology` and `history` are one or two sentences a reader without linguistics follows, without brackets, references or language abbreviations; without reliable data the field is left out, not invented. `history` stays wherever `categoriesRequiringHistory` asks for it.
- A Word has 2 or 3 Examples, at least one the Edition's own sentence, without `author`, whose context shows the meaning.
- `rarity` starts from the Zipf frequency of the Lemma in `wordfreq` (`uk`), on bands taken from the collection itself, about a fifth of the Words each (quantiles of the live Words on 15.11): Zipf 2.5 or more → 1, 1.93 to 2.5 → 2, 1.48 to 1.93 → 3, above 0 and below 1.48 → 4, absent from `wordfreq` (Zipf 0) → 5. The bands are relative because `wordfreq` counts only the exact form, not the inflected ones, and because every Word is rare: the general-vocabulary bands (4.2 / 3.5 / 2.8 / 2.0) put 63% of the Words on 5 and left 42 under the Rarity Ceiling «до 2». The `archaic` or `dialectal` register label adds 1, at most 5. The editor may move the result one step either way and says why in the report. A Word absent from `wordfreq` is never left on 5 blindly: the editor judges whether an ordinary speaker knows it (as дзвонар or худорлявий) and, if so, lowers it by one or two steps, saying why.
- `synonyms` and `antonyms` help the reader grasp the Word. Single words are not protected, so apt ones from the old record may stay and the editor adds exact ones. A Word has 1–4 synonyms, the most apt, clear and literary, with no narrow dialect words or surzhyk; synonyms and antonyms are of the Word's part of speech and in their base form (nominative, infinitive). A device, a term or a unique thing with no direct synonym or antonym keeps `[]`; no made-up phrase stands in for one. No notes in brackets, asterisks or abbreviations: only plain words or short set phrases.

### Corrections

- One non-standard form and one standard equivalent: `standardEquivalents` holds one item, and any other standard variant is named in the explanation.
- The two forms agree in case, number, gender and tense.
- The explanation, one or two plain sentences without officialese or linguistic terms, says why: a calque, surzhyk or russianism is a language error; an anglicism is an undesirable borrowing with an apt Ukrainian equivalent. The other Correction Types say their own reason the same way.
- The example pair shows the standard form in a sentence, beside the non-standard one where a contrast helps.

### Idioms

- The Idiom Type is exact: `idiom` is a fixed phrase that is not a whole sentence and stands for a word or an action; `proverb` is a whole sentence with an instructive or figurative conclusion; `placeName` is a real geographical name.
- An `idiom` or a `proverb` is explained by its real figurative meaning, not a word-for-word reading, and has a modern Example in which it sounds natural.
- A `placeName`'s etymology follows present-day Ukrainian history and toponymy, without Soviet or imperial myths.

### Synonym Rows

- 5 to 12 members, all of the dominant's part of speech and in their base form.
- The row mixes neutral, bookish, colloquial and emotionally coloured members, not one tone.
- No repeats, narrow dialect words, surzhyk, old phonetic variants of one word or loose associations.

### Tips

- The rule reads in 3 to 5 seconds: what to say and what to avoid.
- A Tip is about live speech (etiquette, verb government, prepositions, stress), not rare spelling exceptions.
- When the avoided form is standard in another meaning or context, that is an exception in `exceptions`.
- At least one Example of the right use, and one for each exception.

### New content

- Candidates are gathered with about 30% to spare for what is dropped: Words from goroh («Найцікавіші слова»), Грінченко, ЕСУМ and the ГРАК corpus, without officialese, Soviet abbreviations or medical Latin; Corrections and anglicisms from OnlineCorrector, «Мова — ДНК нації» and Словотвір; Idioms, proverbs and place names from the phraseological dictionary, goroh «Фразеологія», the collections of Номис and Франко and the toponymic dictionary of Ukraine; Synonym Rows from the synonym dictionaries (common dominants with 5–12 vivid members); Tips from Пономарів, Авраменко, Караванський and the current Правопис. These are working material; the shipped text is written anew under the rules above.
- Each candidate is checked against the live content (`pnpm content have`, the content snapshot), exact matches and words of the same root dropped; Stress, gender, part of speech and inflection are checked against ВЕСУМ or goroh.
- After the owner's yes the candidates are written with `pnpm content add`, one run, one batch, so they are reviewed and rolled back together.

## Consequences

- Existing Entries are rewritten in one editorial pass through the admin write API (ADR 0090), kind by kind and in batches, so every save runs the fast checks and leaves the record unchecked for «Перегляд». Until an Entry is rewritten, ADR 0094 still binds its old text.
- The quote check has nothing to check in a rewritten Entry: it has no source page, so it drops out of the check.
- The «Джерела» section of the «Умови користування» changes once the pass is done: it no longer names quoted dictionaries.
- The `pnpm source:*` drafters give raw material; a draft is rewritten before `pnpm content add`.
- A `history` or `placeName` fact loses its shipped reference (e.g. the register of repressed words). The editor checks it against a reliable source before writing it.
- A Correction with several standard equivalents loses all but the first from `standardEquivalents`; the rest move into its explanation.

## Considered Options

- **Keep quoting, trimmed to one sentence (ADR 0094)**: rejected. The text stays the dictionary's, with its abbreviations and its rights holder.
- **Keep the dictionary names in `sources` as references**: rejected by the owner; the shipped text no longer comes from them.
