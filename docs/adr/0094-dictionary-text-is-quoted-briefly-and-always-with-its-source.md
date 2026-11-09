# Dictionary text is quoted briefly and always with its source

Owner decision of 2026-11-08 (global review, content-H6). ADR 0012 has Definitions quoted word for word from goroh and cited, ADR 0084 sources every goroh kind, and ADR 0045 limits Literary Uses to the public domain. Nothing records why the dictionary text and the Examples by modern authors may be shipped: the dictionaries (СУМ-20, ЕСУМ, Караванський, Пономарів, Антоненко-Давидович, Єфімова and the like) are protected works, and a rights holder who objected after release would find no stated basis. This ADR amends 0012 and 0084: a quotation is still copied word for word, but only one sentence of it, and the Edition's own wording replaces the rest of an article.

**Decision.** Text taken from a dictionary or a reference work is a quotation, and the basis is the right to quote a published work. Four rules follow.

- A quotation is short: at most one sentence of a Definition, an etymology, a Synonym article or a phraseological entry. An article is never copied whole, and the Edition's own wording replaces the rest.
- A quotation always names its source: the dictionary, and where the Source allows it the entry or the page (ADR 0012, 0084).
- In Examples by a protected author, that is one who died less than 70 years ago, the Edition's own sentence is preferred to a quotation. A quotation stays only when it is at most one sentence and names its author and work.
- Literary Uses keep the public-domain rule of ADR 0045; this ADR does not widen it.

The Edition's «Умови користування» carry a «Джерела» section that names the dictionaries quoted and this basis.

**Current content.** The content that ships on 2026-11-08 does not meet the one-sentence rule yet. A heuristic count of sentence ends finds more than one sentence in 524 of 1223 Word etymologies, 38 of 82 Tip explanations, 106 of 152 Correction explanations, 18 of 23 Idiom etymologies and 5 of 96 Idiom primary Definitions. A content ticket trims them. Until it lands, the «Джерела» section says that the dictionaries are quoted briefly and always with their source, and does not state the one-sentence limit.

**Consequences.** This is the owner's recorded policy, not legal advice, and no check enforces it yet. Later work would enforce it: a length check on quoted dictionary text beside the quote check of ADR 0084, a rights note per Source or per dictionary in the Edition config, and a death-year check on Example authors as ADR 0045 has for Literary Uses, which first needs a death year on an Example's author in the schema (an Example carries only `author` today). Until then the rules bind authors and reviewers of content.
